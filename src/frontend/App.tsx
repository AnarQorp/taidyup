import { FolderSearch, Shield, Cpu, Activity, ChevronDown, ChevronUp, Terminal, Layers, FolderPlus, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';
import { FormEvent, useState } from 'react';
import type { LocalProjectAnalysis } from '../application/analyzeLocalProject.js';
import { AnalysisView } from './components/AnalysisView.js';
import { useLocalAnalysis } from './hooks/useLocalAnalysis.js';
import { useConnectedAnalysis } from './hooks/useConnectedAnalysis.js';
import { useOnboarding } from './hooks/useOnboarding.js';
import { OnboardingTour } from './components/OnboardingTour.js';
import type { ConnectedUiRequest } from './adapters/localAnalysisAdapter.js';
import type { ConnectedLocalProjectAnalysis } from '../application/analyzeConnectedLocalProject.js';

export default function App({ analyzeProject, inspectConnected }: { analyzeProject?: (targetPath: string, runtimeArtifactPath?: string) => Promise<LocalProjectAnalysis>; inspectConnected?: (input: ConnectedUiRequest) => Promise<ConnectedLocalProjectAnalysis> }) {
  const [targetPath, setTargetPath] = useState('');
  const [runtimeArtifactPath, setRuntimeArtifactPath] = useState('');
  const [showAdvancedInputs, setShowAdvancedInputs] = useState(false);
  const [connectedInput, setConnectedInput] = useState({ baseUrl: '', workflowId: '', connectionId: '', tokenEnv: 'N8N_API_KEY', authorityMode: 'UNKNOWN' as const, observedArtifactPath: '', allowLoopbackHttp: false });
  const { state, analyze, setDirectResult, setError } = useLocalAnalysis(analyzeProject);
  const connected = useConnectedAnalysis(inspectConnected);
  const loading = state.status === 'loading';
  const displayedState = connected.state.status === 'available' ? { status: 'success' as const, result: connected.state.result } : connected.state.status === 'error' && connected.state.retainedResult ? { status: 'success' as const, result: connected.state.retainedResult } : state;

  const onboarding = useOnboarding(
    (selectedPath) => {
      setTargetPath(selectedPath);
    },
    (demoResult) => {
      setTargetPath(demoResult.project.targetPath);
      setDirectResult(demoResult);
    },
    (errorMessage, details) => {
      setError(errorMessage, details);
    }
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    void analyze(targetPath, runtimeArtifactPath);
  }

  function inspect(event: FormEvent) {
    event.preventDefault();
    void connected.connect({ targetPath, ...connectedInput, observedArtifactPath: connectedInput.observedArtifactPath || undefined, runtimeArtifactPath: runtimeArtifactPath.trim() || undefined });
  }

  return <div className="min-h-screen bg-[#F6F3EC] text-[#1A1D20] font-sans selection:bg-[#1E50C8]/20 selection:text-[#1E50C8]">
    {/* Top Workbench Brand Header */}
    <header className="border-b border-[#1A1D20]/15 bg-[#F2EFE9] sticky top-0 z-40 shadow-sm">
      <div className="h-1 wood-header-strip w-full" />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-3.5">
          <img src="/brand/taidyup-woodcraft-logo.png" alt="tAIdyup logo" className="h-9 w-auto object-contain drop-shadow-2xs select-none" />
          <div className="border-l border-[#1A1D20]/15 pl-3.5">
            <div className="flex items-center gap-2">
              <span className="rounded border border-[#1E50C8]/30 bg-[#1E50C8]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#1E50C8]">WORKBENCH ALPHA</span>
            </div>
            <p className="text-xs font-semibold text-[#725B38] italic mt-0.5">"Know your AI while you build it."</p>
            <p className="text-[11px] text-[#5C6068]">Local-first developer workbench to check, understand, and evidence AI capabilities.</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-xs code-font text-[#5C6068]">
          <span className="flex items-center gap-1.5 rounded bg-white/60 px-2.5 py-1 border border-[#1A1D20]/10 shadow-2xs"><Cpu className="h-3.5 w-3.5 text-[#1E50C8]" /> AST Scan</span>
          <span className="flex items-center gap-1.5 rounded bg-white/60 px-2.5 py-1 border border-[#1A1D20]/10 shadow-2xs"><Activity className="h-3.5 w-3.5 text-[#6D28D9]" /> Connected n8n</span>
          <span className="flex items-center gap-1.5 rounded bg-white/60 px-2.5 py-1 border border-[#1A1D20]/10 shadow-2xs"><Shield className="h-3.5 w-3.5 text-[#059669]" /> Local First</span>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* Initial Experience: What do you want to analyze? */}
      <section className="workbench-card p-6 shadow-md border border-[#1A1D20]/15">
        <div className="flex items-center justify-between border-b border-[#1A1D20]/10 pb-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-[#1A1D20] flex items-center gap-2 heading-font">
              <FolderSearch className="h-5 w-5 text-[#1E50C8]" /> What do you want to analyze?
            </h2>
            <p className="mt-1 text-xs text-[#5C6068]">
              Select a local project directory to reconcile AST code claims against AST observations.
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#059669] bg-[#059669]/10 border border-[#059669]/25 px-2.5 py-1 rounded">
            LOOPBACK LOCAL PROCESS
          </span>
        </div>

        <form onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <FolderSearch className="absolute left-3.5 top-3 h-4 w-4 text-[#5C6068]" />
              <input
                id="project-path"
                value={targetPath}
                onChange={event => setTargetPath(event.target.value)}
                disabled={loading}
                placeholder="/absolute/path/to/project"
                className="w-full rounded-md border border-[#1A1D20]/20 bg-white py-2.5 pl-10 pr-3 font-mono text-xs text-[#1A1D20] outline-none focus:border-[#1E50C8] focus:ring-1 focus:ring-[#1E50C8] transition-all shadow-2xs"
              />
            </div>
            <button
              type="button"
              onClick={onboarding.handleChooseFolder}
              disabled={loading || onboarding.pickerState.status === 'selecting'}
              className="rounded-md border border-[#1A1D20]/20 bg-white px-4 py-2.5 text-xs font-bold text-[#1A1D20] hover:bg-[#F2EFE9] disabled:opacity-50 transition-all shadow-2xs flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
            >
              <FolderPlus className="h-4 w-4 text-[#1E50C8]" />
              {onboarding.pickerState.status === 'selecting' ? 'Choosing…' : 'Choose folder'}
            </button>
            <button
              disabled={loading}
              className="rounded-md bg-[#1E50C8] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#1640A8] disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
            >
              {loading ? 'Analyzing…' : 'Analyze with tAIdyup'}
            </button>
          </div>

          {/* Folder Picker Warning/Error Feedback */}
          {(onboarding.pickerState.status === 'PICKER_UNAVAILABLE' || onboarding.pickerState.status === 'PICKER_FAILED') && onboarding.pickerState.message && (
            <p className="mt-2 text-xs font-semibold text-[#B45309] bg-[#FFFBEB] p-2.5 rounded border border-[#D97706]/30 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[#B45309] shrink-0" />
              {onboarding.pickerState.message}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowAdvancedInputs(!showAdvancedInputs)}
              className="text-xs font-semibold text-[#1E50C8] hover:underline flex items-center gap-1.5 cursor-pointer py-2 px-3 rounded hover:bg-[#1E50C8]/10 transition-colors"
            >
              {showAdvancedInputs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showAdvancedInputs ? 'Hide optional RUNTIME & CONNECTED inputs' : 'Add optional RUNTIME & CONNECTED inputs (Progressive Disclosure)'}
            </button>
            <div className="flex items-center gap-2">
              <span className="rounded border border-[#725B38]/40 bg-[#C8B698]/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#725B38]">OPT-IN</span>
              <span className="text-[11px] text-[#5C6068]">Token value stays in the local Node process environment. Local AST scan operates without uploading source code or remote APIs.</span>
            </div>
          </div>

          {/* Progressive Disclosure Section for RUNTIME & CONNECTED */}
          {showAdvancedInputs && (
            <div className="mt-4 pt-4 border-t border-[#1A1D20]/10 space-y-4">
              {/* Optional Sanitized Runtime Artifact */}
              <div className="workbench-panel p-4 rounded-md">
                <label className="text-xs font-bold text-[#1A1D20] flex items-center gap-1.5">
                  <Terminal className="h-4 w-4 text-[#059669]" /> Optional Sanitized RUNTIME Evidence Artifact
                </label>
                <p className="mt-1 text-xs text-[#5C6068]">
                  Import execution evidence from a local sanitized JSONL log file. No continuous monitoring process is started.
                </p>
                <input
                  aria-label="Runtime artifact"
                  value={runtimeArtifactPath}
                  onChange={event => setRuntimeArtifactPath(event.target.value)}
                  disabled={loading}
                  placeholder="/path/to/sanitized-runtime-events.jsonl (optional)"
                  className="mt-2.5 w-full rounded border border-[#1A1D20]/20 bg-white px-3 py-2 font-mono text-xs text-[#1A1D20] outline-none focus:border-[#1E50C8]"
                />
              </div>

              {/* Optional Connected n8n Inspector */}
              <div className="workbench-panel p-4 rounded-md">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#1A1D20] text-xs flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-[#6D28D9]" /> Optional CONNECTED Evidence · n8n Workflow Inspector
                  </h3>
                  <span className="rounded border border-[#725B38]/30 bg-[#C8B698]/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#725B38]">
                    OPT-IN
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#5C6068]">
                  Inspect live workflow configuration. GET only · execution no · monitoring no · credential validation no.
                </p>
                <div className="mt-3 grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                  <input aria-label="n8n base URL" placeholder="n8n base URL (e.g. http://localhost:5678)" value={connectedInput.baseUrl} onChange={e => setConnectedInput({ ...connectedInput, baseUrl: e.target.value })} className="rounded border border-[#1A1D20]/20 bg-white px-3 py-1.5 text-xs text-[#1A1D20] outline-none focus:border-[#1E50C8]" />
                  <input aria-label="Workflow ID" placeholder="Workflow ID" value={connectedInput.workflowId} onChange={e => setConnectedInput({ ...connectedInput, workflowId: e.target.value })} className="rounded border border-[#1A1D20]/20 bg-white px-3 py-1.5 text-xs text-[#1A1D20] outline-none focus:border-[#1E50C8]" />
                  <input aria-label="Connection ID" placeholder="Connection ID" value={connectedInput.connectionId} onChange={e => setConnectedInput({ ...connectedInput, connectionId: e.target.value })} className="rounded border border-[#1A1D20]/20 bg-white px-3 py-1.5 text-xs text-[#1A1D20] outline-none focus:border-[#1E50C8]" />
                  <input aria-label="Token environment variable" placeholder="N8N_API_KEY (env var name)" value={connectedInput.tokenEnv} onChange={e => setConnectedInput({ ...connectedInput, tokenEnv: e.target.value })} className="rounded border border-[#1A1D20]/20 bg-white px-3 py-1.5 font-mono text-xs text-[#1A1D20] outline-none focus:border-[#1E50C8]" />
                  <select aria-label="Authority mode" value={connectedInput.authorityMode} onChange={e => setConnectedInput({ ...connectedInput, authorityMode: e.target.value as any })} className="rounded border border-[#1A1D20]/20 bg-white px-3 py-1.5 text-xs text-[#1A1D20] outline-none focus:border-[#1E50C8]"><option>UNKNOWN</option><option>CLIENT_ENFORCED_READ_ONLY</option><option>TECHNICALLY_READ_ONLY</option></select>
                  <input aria-label="Observed workflow artifact" placeholder="Observed artifact path (optional)" value={connectedInput.observedArtifactPath} onChange={e => setConnectedInput({ ...connectedInput, observedArtifactPath: e.target.value })} className="rounded border border-[#1A1D20]/20 bg-white px-3 py-1.5 text-xs text-[#1A1D20] outline-none focus:border-[#1E50C8]" />
                </div>
                <label className="mt-3 flex items-center gap-2 text-xs text-[#5C6068] cursor-pointer"><input type="checkbox" checked={connectedInput.allowLoopbackHttp} onChange={e => setConnectedInput({ ...connectedInput, allowLoopbackHttp: e.target.checked })} className="rounded border-[#1A1D20]/20 text-[#1E50C8]" />Allow HTTP only for an explicit loopback development instance</label>
                <div className="mt-3 flex items-center gap-3">
                  <button type="button" onClick={inspect} disabled={connected.state.status === 'retrieving'} className="rounded bg-[#6D28D9] px-4 py-2 text-xs font-bold text-white hover:bg-[#5B21B6] disabled:opacity-50 transition-all shadow-2xs">{connected.state.status === 'retrieving' ? 'Inspecting connected configuration…' : 'Inspect connected configuration'}</button>
                  <span className="text-xs text-[#5C6068]">Token value stays in the local Node process.</span>
                </div>
                {connected.state.status === 'error' && <p className="mt-2 rounded border border-rose-400/40 bg-rose-50 p-2.5 text-xs text-rose-800">CONNECTED unavailable: {connected.state.message}. Local evidence remains available.</p>}
              </div>
            </div>
          )}

          {/* Secondary First-Use Path: Try demo project */}
          <div className="mt-6 pt-5 border-t border-[#1A1D20]/15 flex flex-wrap items-center justify-between gap-4 bg-[#F2EFE9]/50 p-4 rounded-lg">
            <div className="max-w-xl">
              <h3 className="text-sm font-bold text-[#1A1D20] flex items-center gap-2 heading-font">
                <Sparkles className="h-4 w-4 text-[#1E50C8]" /> New to tAIdyup?
              </h3>
              <p className="mt-1 text-xs text-[#5C6068]">
                Try the bundled onboarding demo to learn how tAIdyup separates intended authority, technical code evidence, current connections, and observed execution. Takes about 2 minutes.
              </p>
            </div>
            <button
              type="button"
              onClick={onboarding.handleTryDemo}
              disabled={loading || onboarding.isDemoLoading}
              className="rounded-md border border-[#1E50C8]/40 bg-[#1E50C8]/10 px-5 py-2.5 text-xs font-bold text-[#1E50C8] hover:bg-[#1E50C8] hover:text-white transition-all shadow-2xs flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              {onboarding.isDemoLoading ? 'Loading demo…' : 'Try demo project'}
            </button>
          </div>
        </form>
      </section>

      {/* Main Analysis Results View */}
      <AnalysisView state={displayedState} onStartTour={onboarding.startTour} />
    </main>

    {/* Guided Tour Modal Component */}
    <OnboardingTour
      active={onboarding.tourActive}
      stepIndex={onboarding.tourStep}
      onNext={onboarding.nextStep}
      onPrev={onboarding.prevStep}
      onClose={onboarding.stopTour}
      onFinish={() => {
        onboarding.stopTour();
        document.getElementById('project-path')?.focus();
        document.getElementById('project-path')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }}
    />
  </div>;
}
