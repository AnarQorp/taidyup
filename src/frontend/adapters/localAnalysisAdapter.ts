import type { LocalProjectAnalysis, ProjectAnalysisErrorCode } from '../../application/analyzeLocalProject.js';

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

export async function requestLocalAnalysis(targetPath: string): Promise<LocalProjectAnalysis> {
  const response = await fetch('/local-api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetPath })
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
