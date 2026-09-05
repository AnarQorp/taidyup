import type { Evidence } from '../trust-kernel/types.js';
import type { ConnectorAuthorityMode } from '../connected/n8n/n8nConnectedClient.js';
import { analyzeConnectedN8nWorkflow, type ConnectedN8nAnalysis } from './analyzeConnectedN8nWorkflow.js';
import { analyzeLocalProject, type LocalProjectAnalysis } from './analyzeLocalProject.js';

export interface ConnectedLocalProjectAnalysis extends LocalProjectAnalysis {
  connected: Pick<ConnectedN8nAnalysis, 'snapshot' | 'disclosure' | 'diagnostics' | 'absenceEvidences'>;
}

export async function analyzeConnectedLocalProject(input: {
  targetPath: string;
  baseUrl: string;
  workflowId: string;
  connectionId: string;
  token: string;
  tokenEnv: string;
  authorityMode: ConnectorAuthorityMode;
  observedArtifactPath?: string;
  allowLoopbackHttp?: boolean;
  previousConnectedEvidences?: Evidence[];
}): Promise<ConnectedLocalProjectAnalysis> {
  const local = await analyzeLocalProject(input.targetPath);
  const connected = await analyzeConnectedN8nWorkflow({
    config: {
      provider: 'n8n', baseUrl: input.baseUrl, token: input.token,
      connectionId: input.connectionId, authorityMode: input.authorityMode,
      allowLoopbackHttp: input.allowLoopbackHttp
    },
    workflowId: input.workflowId,
    observedArtifactPath: input.observedArtifactPath,
    previousConnectedEvidences: input.previousConnectedEvidences,
    declaredClaims: local.declaredClaims,
    declarationEvidence: local.evidence.filter(item => item.sourceType === 'DECLARATION'),
    additionalEvidences: local.evidence.filter(item => item.sourceType === 'STATIC')
  });
  const evidence = [
    ...local.evidence,
    ...connected.observedEvidences,
    ...(input.previousConnectedEvidences ?? []),
    ...connected.evidences,
    ...connected.absenceEvidences
  ].filter((item, index, items) => items.findIndex(candidate => candidate.id === item.id) === index);
  return {
    ...local,
    subjects: Array.from(new Set(connected.reconciliation.reconciledClaims.map(claim => claim.subject))),
    evidence,
    reconciliation: connected.reconciliation,
    connected: {
      snapshot: connected.snapshot,
      disclosure: connected.disclosure,
      diagnostics: connected.diagnostics,
      absenceEvidences: connected.absenceEvidences
    }
  };
}
