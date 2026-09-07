import { useState } from 'react';
import type { LocalProjectAnalysis } from '../../application/analyzeLocalProject.js';
import type { ConnectedLocalProjectAnalysis } from '../../application/analyzeConnectedLocalProject.js';
import { requestLocalAnalysis } from '../adapters/localAnalysisAdapter.js';

export type AnalysisUiState =
  | { status: 'idle' }
  | { status: 'loading'; targetPath: string }
  | { status: 'success'; result: LocalProjectAnalysis | ConnectedLocalProjectAnalysis }
  | { status: 'error'; message: string; details: string[] };

export function useLocalAnalysis(analyzeProject = requestLocalAnalysis) {
  const [state, setState] = useState<AnalysisUiState>({ status: 'idle' });

  async function analyze(targetPath: string, runtimeArtifactPath?: string) {
    const normalizedPath = targetPath.trim();
    if (!normalizedPath) {
      setState({ status: 'error', message: 'Choose an existing local project directory.', details: [] });
      return;
    }
    setState({ status: 'loading', targetPath: normalizedPath });
    try {
      setState({ status: 'success', result: await analyzeProject(normalizedPath, runtimeArtifactPath?.trim() || undefined) });
    } catch (error: any) {
      setState({
        status: 'error',
        message: error?.message || 'The local analysis could not be completed.',
        details: Array.isArray(error?.details) ? error.details : []
      });
    }
  }

  function setDirectResult(result: LocalProjectAnalysis | ConnectedLocalProjectAnalysis) {
    setState({ status: 'success', result });
  }

  function setError(message: string, details: string[] = []) {
    setState({ status: 'error', message, details });
  }

  return { state, analyze, setDirectResult, setError };
}
