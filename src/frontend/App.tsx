import { FolderSearch, Shield } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { LocalProjectAnalysis } from '../application/analyzeLocalProject.js';
import { AnalysisView } from './components/AnalysisView.js';
import { useLocalAnalysis } from './hooks/useLocalAnalysis.js';
import { useConnectedAnalysis } from './hooks/useConnectedAnalysis.js';
import type { ConnectedUiRequest } from './adapters/localAnalysisAdapter.js';
import type { ConnectedLocalProjectAnalysis } from '../application/analyzeConnectedLocalProject.js';

export default function App({ analyzeProject, inspectConnected }: { analyzeProject?: (targetPath: string) => Promise<LocalProjectAnalysis>; inspectConnected?: (input: ConnectedUiRequest) => Promise<ConnectedLocalProjectAnalysis> }) {
  const [targetPath, setTargetPath] = useState('');
  const [connectedInput, setConnectedInput] = useState({ baseUrl: '', workflowId: '', connectionId: '', tokenEnv: 'N8N_API_KEY', authorityMode: 'UNKNOWN' as const, observedArtifactPath: '', allowLoopbackHttp: false });
  const { state, analyze } = useLocalAnalysis(analyzeProject);
  const connected = useConnectedAnalysis(inspectConnected);
  const loading = state.status === 'loading';
  const displayedState = connected.state.status === 'available' ? { status: 'success' as const, result: connected.state.result } : connected.state.status === 'error' && connected.state.retainedResult ? { status: 'success' as const, result: connected.state.retainedResult } : state;

  function submit(event: FormEvent) {
    event.preventDefault();
    void analyze(targetPath);
  }

  function inspect(event: FormEvent) {
    event.preventDefault();
    void connected.connect({ targetPath, ...connectedInput, observedArtifactPath: connectedInput.observedArtifactPath || undefined });
  }

  return <div className="min-h-screen bg-[#031427] text-[#d3e4fe]">
    <header className="border-b border-white/10 bg-[#07192e]/90"><div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4"><div className="rounded-lg border border-primary/40 bg-primary/20 p-2"><Shield className="h-5 w-5 text-primary-light" /></div><div><div className="flex items-center gap-2"><h1 className="font-bold text-white">tAIdyup</h1><span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary-light">LOCAL ALPHA</span></div><p className="text-xs text-[#8d90a0]">Declared intent and available evidence, reconciled by the Trust Kernel.</p></div></div></header>
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <section className="glass-panel rounded-xl p-5"><form onSubmit={submit}><label htmlFor="project-path" className="text-sm font-bold text-white">Local project directory</label><p className="mt-1 text-xs text-[#8d90a0]">The loopback-only process reads this directory locally. It does not clone, fetch, upload source, or use remote provider APIs.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><FolderSearch className="absolute left-3 top-2.5 h-4 w-4 text-[#8d90a0]" /><input id="project-path" value={targetPath} onChange={event => setTargetPath(event.target.value)} disabled={loading} placeholder="/absolute/path/to/project" className="w-full rounded-md border border-white/15 bg-[#031427] py-2.5 pl-10 pr-3 font-mono text-xs text-white outline-none focus:border-primary" /></div><button disabled={loading} className="rounded-md bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-50">{loading ? 'Analyzing…' : 'Analyze with tAIdyup'}</button></div></form></section>
      <section className="glass-panel rounded-xl p-5"><form onSubmit={inspect}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-white">CONNECTED evidence · n8n</h2><p className="mt-1 text-xs text-[#8d90a0]">Explicit point-in-time inspection. GET only · execution no · monitoring no · credential validation no · analysis local.</p></div><span className="rounded border border-amber-300/30 px-2 py-1 font-mono text-[10px] text-amber-200">OPT-IN</span></div><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <input aria-label="n8n base URL" placeholder="n8n base URL" value={connectedInput.baseUrl} onChange={e => setConnectedInput({ ...connectedInput, baseUrl: e.target.value })} className="rounded border border-white/15 bg-[#031427] px-3 py-2 text-xs" />
        <input aria-label="Workflow ID" placeholder="Workflow ID" value={connectedInput.workflowId} onChange={e => setConnectedInput({ ...connectedInput, workflowId: e.target.value })} className="rounded border border-white/15 bg-[#031427] px-3 py-2 text-xs" />
        <input aria-label="Connection ID" placeholder="Connection ID" value={connectedInput.connectionId} onChange={e => setConnectedInput({ ...connectedInput, connectionId: e.target.value })} className="rounded border border-white/15 bg-[#031427] px-3 py-2 text-xs" />
        <input aria-label="Token environment variable" placeholder="N8N_API_KEY" value={connectedInput.tokenEnv} onChange={e => setConnectedInput({ ...connectedInput, tokenEnv: e.target.value })} className="rounded border border-white/15 bg-[#031427] px-3 py-2 font-mono text-xs" />
        <select aria-label="Authority mode" value={connectedInput.authorityMode} onChange={e => setConnectedInput({ ...connectedInput, authorityMode: e.target.value as any })} className="rounded border border-white/15 bg-[#031427] px-3 py-2 text-xs"><option>UNKNOWN</option><option>CLIENT_ENFORCED_READ_ONLY</option><option>TECHNICALLY_READ_ONLY</option></select>
        <input aria-label="Observed workflow artifact" placeholder="Observed artifact path (optional)" value={connectedInput.observedArtifactPath} onChange={e => setConnectedInput({ ...connectedInput, observedArtifactPath: e.target.value })} className="rounded border border-white/15 bg-[#031427] px-3 py-2 text-xs" />
      </div><label className="mt-3 flex items-center gap-2 text-xs text-[#8d90a0]"><input type="checkbox" checked={connectedInput.allowLoopbackHttp} onChange={e => setConnectedInput({ ...connectedInput, allowLoopbackHttp: e.target.checked })} />Allow HTTP only for an explicit loopback development instance</label><div className="mt-4 flex items-center gap-3"><button disabled={connected.state.status === 'retrieving'} className="rounded bg-primary px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">{connected.state.status === 'retrieving' ? 'Inspecting…' : 'Inspect current configuration'}</button><span className="text-xs text-[#8d90a0]">Token value stays in the local Node process.</span></div>{connected.state.status === 'error' && <p className="mt-3 rounded border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-100">CONNECTED unavailable: {connected.state.message}. Local evidence remains available.</p>}</form></section>
      <AnalysisView state={displayedState} />
    </main>
  </div>;
}
