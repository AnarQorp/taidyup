import type { LocalProjectAnalysis, ProjectAnalysisErrorCode } from '../../application/analyzeLocalProject.js';
import type { ConnectedLocalProjectAnalysis } from '../../application/analyzeConnectedLocalProject.js';
import type { BundledDemoAnalysis } from '../../application/analyzeBundledDemo.js';
import type { DirectoryPickerResult } from '../../local-ui/folderPicker.js';

export class LocalAnalysisRequestError extends Error {
  constructor(
    public readonly code: ProjectAnalysisErrorCode | 'TARGET_REQUIRED' | 'NON_LOCAL_ORIGIN' | 'ANALYSIS_FAILED',
    message: string,
    public readonly details: string[] = []
  ) {
    super(message);
    this.name = 'LocalAnalysisRequestError';
  }
}

export async function requestLocalAnalysis(targetPath: string, runtimeArtifactPath?: string): Promise<LocalProjectAnalysis> {
  const response = await fetch('/local-api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetPath, runtimeArtifactPath })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new LocalAnalysisRequestError(
      payload.error?.code || 'ANALYSIS_FAILED',
      payload.error?.message || 'The local analysis could not be completed.',
      payload.error?.details || []
    );
  }
  return payload as LocalProjectAnalysis;
}

export async function selectDirectory(): Promise<DirectoryPickerResult> {
  const response = await fetch('/local-api/select-directory', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const payload = await response.json();
  if (!response.ok) throw new LocalAnalysisRequestError(payload.error?.code || 'ANALYSIS_FAILED', payload.error?.message || 'The directory picker could not be opened.');
  return payload as DirectoryPickerResult;
}

export async function analyzeBundledDemo(): Promise<BundledDemoAnalysis> {
  const response = await fetch('/local-api/demo-analysis', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const payload = await response.json();
  if (!response.ok) throw new LocalAnalysisRequestError(payload.error?.code || 'ANALYSIS_FAILED', payload.error?.message || 'The bundled demo could not be analyzed.');
  return payload as BundledDemoAnalysis;
}

export interface ConnectedUiRequest {
  targetPath: string; baseUrl: string; workflowId: string; connectionId: string;
  tokenEnv: string; authorityMode: 'TECHNICALLY_READ_ONLY' | 'CLIENT_ENFORCED_READ_ONLY' | 'UNKNOWN';
  observedArtifactPath?: string; runtimeArtifactPath?: string; allowLoopbackHttp?: boolean;
}

export async function requestConnectedAnalysis(input: ConnectedUiRequest): Promise<ConnectedLocalProjectAnalysis> {
  const response = await fetch('/local-api/connected-n8n', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input)
  });
  const payload = await response.json();
  if (!response.ok) throw new LocalAnalysisRequestError(payload.error?.code || 'ANALYSIS_FAILED', payload.error?.message || 'CONNECTED inspection could not be completed.', payload.error?.details || []);
  return payload as ConnectedLocalProjectAnalysis;
}
