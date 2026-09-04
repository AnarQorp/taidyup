import { useState } from 'react';
import type { LocalProjectAnalysis } from '../../application/analyzeLocalProject.js';
import { requestLocalAnalysis } from '../adapters/localAnalysisAdapter.js';

export type AnalysisUiState =
  | { status: 'idle' }
  | { status: 'loading'; targetPath: string }
  | { status: 'success'; result: LocalProjectAnalysis }
  | { status: 'error'; message: string; details: string[] };

export function useLocalAnalysis(analyzeProject = requestLocalAnalysis) {
  const [state, setState] = useState<AnalysisUiState>({ status: 'idle' });

  async function analyze(targetPath: string) {
    const normalizedPath = targetPath.trim();
    if (!normalizedPath) {
      setState({ status: 'error', message: 'Choose an existing local project directory.', details: [] });
      return;
    }
    setState({ status: 'loading', targetPath: normalizedPath });
    try {
      setState({ status: 'success', result: await analyzeProject(normalizedPath) });
    } catch (error: any) {
      setState({
        status: 'error',
        message: error?.message || 'The local analysis could not be completed.',
        details: Array.isArray(error?.details) ? error.details : []
      });
    }
  }

  return { state, analyze };
}
