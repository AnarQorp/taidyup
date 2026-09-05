import fs from 'node:fs';
import { N8nConnectedClient, N8nConnectedResult, N8nConnectionConfig } from '../connected/n8n/n8nConnectedClient.js';
import { N8nWorkflowAdapter } from '../workflows/adapters/n8n/n8nWorkflowAdapter.js';
import { Claim, Evidence, ReconciledTrustState } from '../trust-kernel/types.js';
import { ReconciliationEngine } from '../trust-kernel/reconciliationEngine.js';

export interface ConnectedN8nAnalysis extends N8nConnectedResult {
  observedEvidences: Evidence[];
  absenceEvidences: Evidence[];
  reconciliation: ReconciledTrustState;
}

function key(evidence: Evidence): string {
  return `${evidence.subject}\0${evidence.data?.capability ?? ''}\0${evidence.data?.resource ?? ''}`;
}

function explicitComparisonIdentity(evidence: Evidence, sourceInstance: string, scope: string): Evidence {
  return { ...evidence, data: { ...evidence.data, configurationIdentity: { sourceInstance, scope }, comparisonBinding: 'EXPLICIT_USER_SELECTED_WORKFLOW' } };
}

function absences(previous: Evidence[], current: Evidence[], template: N8nConnectedResult): Evidence[] {
  const currentKeys = new Set(current.filter(item => item.data?.capability).map(key));
  return previous.filter(item => item.data?.capability && !currentKeys.has(key(item))).map(item => {
    const data = { capability: item.data.capability, resource: item.data.resource, resourceDescriptor: item.data.resourceDescriptor, capabilityPathBound: item.data.capabilityPathBound, observation: 'ABSENCE_OBSERVED', absenceReason: 'NOT_PRESENT_IN_COMPLETE_CURRENT_WORKFLOW_SNAPSHOT', connectedSnapshot: template.snapshot, evidenceLayer: 'CONNECTED' };
    return { id: `ev-connected-absence-${template.snapshot.responseHash.slice(0, 12)}-${item.id}`, type: 'CONNECTED_CAPABILITY_ABSENCE', sourceType: 'CONNECTED', subject: item.subject, observedAt: template.snapshot.observedAt, collectorId: 'taidyup-n8n-connected', collectorVersion: N8nConnectedClient.VERSION, artifact: `connected:n8n:${template.snapshot.sourceInstance}:${template.snapshot.workflowId}`, data, strength: item.strength, sha256: template.snapshot.responseHash, provenance: { file: `connected:n8n:workflow:${template.snapshot.workflowId}` } } satisfies Evidence;
  });
}

/** Explicit opt-in application entrypoint. No caller of local scan imports this module. */
export async function analyzeConnectedN8nWorkflow(input: {
  config: N8nConnectionConfig;
  workflowId: string;
  observedArtifactPath?: string;
  previousConnectedEvidences?: Evidence[];
  additionalEvidences?: Evidence[];
  declaredClaims?: Claim[];
  declarationEvidence?: Evidence[];
}): Promise<ConnectedN8nAnalysis> {
  const connected = await N8nConnectedClient.collect(input.config, input.workflowId);
  const identity = { sourceInstance: connected.snapshot.sourceInstance, scope: connected.snapshot.scope };
  const observed = input.observedArtifactPath
    ? N8nWorkflowAdapter.adapt(fs.readFileSync(input.observedArtifactPath), input.observedArtifactPath, { observedAt: fs.statSync(input.observedArtifactPath).mtime.toISOString() }).evidences.map(item => explicitComparisonIdentity(item, identity.sourceInstance, identity.scope))
    : [];
  const previous = (input.previousConnectedEvidences ?? []).filter(item => item.sourceType === 'CONNECTED' &&
    item.data?.connectedSnapshot?.sourceInstance === identity.sourceInstance && item.data?.connectedSnapshot?.scope === identity.scope);
  const priorComparable = [...observed, ...previous];
  const absenceEvidences = absences(priorComparable, connected.evidences, connected);
  const allEvidence = [...(input.declarationEvidence ?? []), ...(input.additionalEvidences ?? []), ...observed, ...previous, ...connected.evidences, ...absenceEvidences];
  const reconciliation = ReconciliationEngine.reconcile(input.declaredClaims ?? [], allEvidence);
  return { ...connected, observedEvidences: observed, absenceEvidences, reconciliation };
}
