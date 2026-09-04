import { FolderSearch, Shield } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { LocalProjectAnalysis } from '../application/analyzeLocalProject.js';
import { AnalysisView } from './components/AnalysisView.js';
import { useLocalAnalysis } from './hooks/useLocalAnalysis.js';

export default function App({ analyzeProject }: { analyzeProject?: (targetPath: string) => Promise<LocalProjectAnalysis> }) {
  const [targetPath, setTargetPath] = useState('');
  const { state, analyze } = useLocalAnalysis(analyzeProject);
  const loading = state.status === 'loading';

  function submit(event: FormEvent) {
    event.preventDefault();
    void analyze(targetPath);
  }

  return <div className="min-h-screen bg-[#031427] text-[#d3e4fe]">
    <header className="border-b border-white/10 bg-[#07192e]/90"><div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4"><div className="rounded-lg border border-primary/40 bg-primary/20 p-2"><Shield className="h-5 w-5 text-primary-light" /></div><div><div className="flex items-center gap-2"><h1 className="font-bold text-white">tAIdyup</h1><span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary-light">LOCAL ALPHA</span></div><p className="text-xs text-[#8d90a0]">Declared intent and observed implementation, reconciled by the Trust Kernel.</p></div></div></header>
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <section className="glass-panel rounded-xl p-5"><form onSubmit={submit}><label htmlFor="project-path" className="text-sm font-bold text-white">Local project directory</label><p className="mt-1 text-xs text-[#8d90a0]">The loopback-only process reads this directory locally. It does not clone, fetch, upload source, or use remote provider APIs.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><FolderSearch className="absolute left-3 top-2.5 h-4 w-4 text-[#8d90a0]" /><input id="project-path" value={targetPath} onChange={event => setTargetPath(event.target.value)} disabled={loading} placeholder="/absolute/path/to/project" className="w-full rounded-md border border-white/15 bg-[#031427] py-2.5 pl-10 pr-3 font-mono text-xs text-white outline-none focus:border-primary" /></div><button disabled={loading} className="rounded-md bg-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-50">{loading ? 'Analyzing…' : 'Analyze with tAIdyup'}</button></div></form></section>
      <AnalysisView state={state} />
    </main>
  </div>;
}
