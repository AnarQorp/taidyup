import { useState } from 'react';
import type { ConnectedLocalProjectAnalysis } from '../../application/analyzeConnectedLocalProject.js';
import { requestConnectedAnalysis, type ConnectedUiRequest } from '../adapters/localAnalysisAdapter.js';

export type ConnectedUiState =
  | { status: 'not_connected' }
  | { status: 'retrieving' }
  | { status: 'available'; result: ConnectedLocalProjectAnalysis }
  | { status: 'error'; message: string; retainedResult?: ConnectedLocalProjectAnalysis };

export function useConnectedAnalysis(inspect = requestConnectedAnalysis) {
  const [state, setState] = useState<ConnectedUiState>({ status: 'not_connected' });
  async function connect(input: ConnectedUiRequest) {
    const retainedResult = state.status === 'available' ? state.result : state.status === 'error' ? state.retainedResult : undefined;
    setState({ status: 'retrieving' });
    try { setState({ status: 'available', result: await inspect(input) }); }
    catch (error: any) { setState({ status: 'error', message: error?.message || 'CONNECTED inspection failed.', retainedResult }); }
  }
  return { state, connect };
}
