import fs from 'node:fs';
import path from 'node:path';
import { N8nWorkflowAdapter, WorkflowAdapterOutput } from '../workflows/adapters/n8n/n8nWorkflowAdapter.js';
import { Claim, Evidence, ReconciledTrustState } from '../trust-kernel/types.js';
import { ReconciliationEngine } from '../trust-kernel/reconciliationEngine.js';

export interface LocalWorkflowAnalysis extends WorkflowAdapterOutput {
  reconciliation: ReconciledTrustState;
}

/** Local-only Workflow Evidence V0 entrypoint. It never resolves URLs or contacts n8n. */
export function analyzeLocalN8nWorkflow(
  artifactPath: string,
  declaredClaims: Claim[] = [],
  declarationEvidence: Evidence[] = []
): LocalWorkflowAnalysis {
  const resolved = path.resolve(artifactPath);
  const raw = fs.readFileSync(resolved);
  const adapted = N8nWorkflowAdapter.adapt(raw, resolved);
  const reconciliation = ReconciliationEngine.reconcile(
    [...declaredClaims, ...adapted.claims],
    [...declarationEvidence, ...adapted.evidences]
  );
  return { ...adapted, reconciliation };
}
