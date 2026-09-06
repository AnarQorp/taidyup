import { AlertTriangle, FileCode2, Layers3, Search, X, HelpCircle, ArrowRightLeft, Shield, CheckCircle2, AlertCircle, HelpCircle as QuestionIcon, Terminal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { LocalProjectAnalysis } from '../../application/analyzeLocalProject.js';
import type { ConnectedLocalProjectAnalysis } from '../../application/analyzeConnectedLocalProject.js';
import type { Claim, DimensionAssessment, EpistemicState, Evidence } from '../../trust-kernel/types.js';
import type { AnalysisUiState } from '../hooks/useLocalAnalysis.js';
import { StateBadge } from './StateBadge.js';

const summaryStates: Array<{ state: EpistemicState; key: keyof LocalProjectAnalysis['reconciliation']['summary']; label: string }> = [
  { state: 'SUPPORTED', key: 'supportedCount', label: 'Supported' },
  { state: 'UNVERIFIED', key: 'unverifiedCount', label: 'Unverified' },
  { state: 'CONFLICT', key: 'conflictCount', label: 'Conflict' },
  { state: 'UNDECLARED_OBSERVATION', key: 'undeclaredCount', label: 'Undeclared observation' },
  { state: 'UNKNOWN', key: 'unknownCount', label: 'Unknown' }
];

function compactPath(value?: string): string {
  if (!value) return 'Unknown source';
  const normalized = value.replaceAll('\\', '/');
  const demoAt = normalized.indexOf('/demo/');
  if (demoAt >= 0) return normalized.slice(demoAt + 1);
  const parts = normalized.split('/').filter(Boolean);
  return parts.slice(-2).join('/') || value;
}

function resourcePresentation(claim: Claim): { label: string; detail?: string; raw?: string } {
  if (!claim.resource) return { label: 'Resource unresolved' };
  try {
    const parsed = JSON.parse(claim.resource) as Record<string, unknown>;
    const artifact = typeof parsed.artifact === 'string' ? parsed.artifact : '';
    const type = typeof parsed.type === 'string' ? parsed.type : '';
    const scope = typeof parsed.scope === 'string' ? parsed.scope : '';
    const artifactName = artifact.split('.').pop()?.replace(/tool$/i, '') || '';
    const label = artifactName
      ? artifactName.charAt(0).toUpperCase() + artifactName.slice(1)
      : type
        ? type.charAt(0).toUpperCase() + type.slice(1)
        : 'Structured resource';
    return { label, detail: scope && scope !== 'unknown' ? scope : 'resource details unresolved', raw: claim.resource };
  } catch {
    return { label: claim.resource, raw: claim.resource };
  }
}

function evidenceForClaim(claim: Claim, result: LocalProjectAnalysis | ConnectedLocalProjectAnalysis): Evidence[] {
  const ids = new Set([...claim.provenance.map(item => item.evidenceId), ...(claim.assessment?.evidenceRefs || []), ...(claim.runtimeAssessment?.evidenceRefs || [])].filter(Boolean));
  return result.evidence.filter(item => ids.has(item.id));
}

function runtimePresentation(claim: Claim): { headline: string; outcome?: string; detail?: string } {
  const runtime = claim.runtimeAssessment;
  if (!runtime || runtime.observationState === 'NO_OBSERVATION') return { headline: 'No runtime evidence available' };
  const headline = runtime.observationState === 'ATTEMPT_OBSERVED' ? 'Execution attempt observed' : runtime.observationState === 'START_OBSERVED' ? 'Execution start observed' : runtime.observationState === 'COMPLETION_OBSERVED' ? 'Completion observed' : 'Result observation reported';
  const outcome = runtime.latestOutcome === 'SUCCEEDED' ? 'Source reported success' : runtime.latestOutcome === 'FAILED' ? 'Source reported failure' : runtime.latestOutcome === 'UNKNOWN' ? 'Source reported unknown outcome' : undefined;
  const instances = runtime.observedExecutionInstances ?? runtime.observedCount;
  const events = runtime.observedEvents ?? runtime.evidenceRefs.length;
  return { headline, outcome, detail: `${instances} distinct execution instance${instances === 1 ? '' : 's'} observed · ${events} runtime event${events === 1 ? '' : 's'} · ${runtime.completeness}` };
}

function hasCurrentDrift(claim: Claim): boolean {
  return Boolean(claim.assessment?.diagnostics.includes('CURRENT_STATE_DRIFT'));
}

function layerSummary(claim: Claim, result: LocalProjectAnalysis | ConnectedLocalProjectAnalysis) {
  const evidence = evidenceForClaim(claim, result);
  const connected = evidence.filter(item => item.sourceType === 'CONNECTED');
  const absence = connected.filter(item => item.data?.observation === 'ABSENCE_OBSERVED');
  const latestConnected = connected
    .filter(item => item.data?.connectedSnapshot)
    .sort((a, b) => Date.parse(b.data.connectedSnapshot.observedAt || b.observedAt) - Date.parse(a.data.connectedSnapshot.observedAt || a.observedAt))[0];
  return {
    declared: evidence.some(item => item.sourceType === 'DECLARATION') || claim.source === 'DECLARATION',
    observed: evidence.some(item => item.sourceType === 'STATIC'),
    connected: absence.length ? 'Changed · absent in latest comparable snapshot' : connected.length ? 'Present' : ('connected' in result ? 'No supporting evidence' : 'Not inspected'),
    latestConnected
  };
}

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  const snapshot = evidence.data?.connectedSnapshot;
  const workflow = evidence.data?.workflowProvenance;
  return <article className="rounded-lg border border-white/10 bg-[#07192e] p-4 text-xs shadow-sm hover:border-white/20 transition-all" data-source-type={evidence.sourceType}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
      <span className="font-mono text-primary-light font-semibold">{evidence.id}</span>
      <span className="rounded border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white tracking-wide">{evidence.sourceType}</span>
    </div>
    <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5">
      <dt className="text-[#8d90a0] font-medium">Type</dt><dd className="text-white">{evidence.type}</dd>
      <dt className="text-[#8d90a0] font-medium">Strength</dt><dd className="font-mono text-sky-200">{evidence.strength}</dd>
      <dt className="text-[#8d90a0] font-medium">Collector</dt><dd className="text-white">{evidence.collectorId} {evidence.collectorVersion}</dd>
      <dt className="text-[#8d90a0] font-medium">Artifact</dt><dd className="break-all font-mono text-primary-light">{evidence.artifact}</dd>
      <dt className="text-[#8d90a0] font-medium">File</dt><dd className="break-all font-mono text-white">{evidence.provenance.file}</dd>
      {evidence.location && <><dt className="text-[#8d90a0] font-medium">Location</dt><dd className="font-mono text-white">{evidence.location}</dd></>}
      {snapshot && <><dt className="text-[#8d90a0] font-medium">Observed at</dt><dd className="font-mono text-white">{snapshot.observedAt || evidence.observedAt}</dd><dt className="text-[#8d90a0] font-medium">Snapshot</dt><dd className="font-mono text-white">{snapshot.retrievalStatus} · {snapshot.completeness}</dd>{snapshot.revision && <><dt className="text-[#8d90a0] font-medium">Revision</dt><dd className="break-all font-mono text-white">{snapshot.revision}</dd></>}</>}
      {workflow?.graph && <><dt className="text-[#8d90a0] font-medium">Relation</dt><dd className="font-mono text-violet-200">{workflow.graph.fromNodeId} → {workflow.graph.toNodeId} · {workflow.graph.relation}</dd></>}
      {evidence.data?.observation === 'ABSENCE_OBSERVED' && <><dt className="text-[#8d90a0] font-medium">Observation</dt><dd className="font-mono text-amber-200 font-bold">ABSENCE_OBSERVED</dd></>}
    </dl>
  </article>;
}

function AssessmentValue({ value }: { value: string }) {
  return <span className="inline-flex rounded border border-white/15 bg-white/5 px-2 py-1 font-mono text-[10px] text-white tracking-wide">{value}</span>;
}

function dimensionExplanation(label: string, value: DimensionAssessment): string {
  if (value === 'SATISFIED') return `${label} is supported by the referenced evidence.`;
  if (value === 'CONTRADICTED') return `${label} has explicitly contradictory evidence on the relevant capability path.`;
  if (value === 'NOT_APPLICABLE') return `${label} does not apply to this claim.`;
  if (label === 'Subject') return 'The observed component is not evidence-bound to the declared subject.';
  if (label === 'Resource') return 'The declared and observed resource descriptions are not established as equivalent.';
  return `${label} is not verified by the available evidence.`;
}

function ClaimAssessment({ claim }: { claim: Claim }) {
  const assessment = claim.assessment;
  if (!assessment) return null;
  const dimensions: Array<[string, DimensionAssessment]> = [
    ['Subject', assessment.subject],
    ['Predicate', assessment.predicate],
    ['Action', assessment.action],
    ['Resource', assessment.resource]
  ];
  const coreObserved = assessment.predicate === 'SATISFIED' && assessment.action === 'SATISFIED';

  return <section className="mt-4 rounded-lg border border-white/10 bg-[#031427] p-4" aria-label="Dimensional assessment">
    <h3 className="text-xs font-bold uppercase tracking-wider text-white">Why this result</h3>
    {coreObserved && <div className="mt-3 rounded-md border border-sky-400/30 bg-sky-400/10 p-3">
      <p className="text-sm font-bold text-sky-100 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-sky-300" /> Core capability observed</p>
      <p className="mt-1 text-xs text-sky-100/80">Static evidence supports the core action dimension. This does not make the full declaration supported.</p>
    </div>}
    <div className="mt-4 grid gap-2">
      {dimensions.map(([label, value]) => <div key={label} className="rounded border border-white/10 p-3 bg-[#07192e]/60">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-white">{label === 'Subject' ? 'Subject binding' : label}</span><AssessmentValue value={value} /></div>
        <p className="mt-2 text-xs text-[#8d90a0]">{dimensionExplanation(label, value)}</p>
      </div>)}
      <div className="rounded border border-white/10 p-3 bg-[#07192e]/60">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-white">Resource relation</span><AssessmentValue value={assessment.resourceRelation} /></div>
        <p className="mt-2 text-xs text-[#8d90a0]">This relation is reported by the Core; the UI does not infer equivalence from similar labels.</p>
      </div>
      <div className="rounded border border-white/10 p-3 bg-[#07192e]/60">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-white">Binding</span><AssessmentValue value={assessment.binding} /></div>
        <p className="mt-2 text-xs text-[#8d90a0]">{assessment.binding === 'UNBOUND' ? 'No evidence-backed subject binding is available for this claim.' : `Binding assessment reported by the Core: ${assessment.binding}.`}</p>
      </div>
    </div>
    {Object.keys(assessment.constraints).length > 0 && <div className="mt-4">
      <h4 className="mb-2 text-xs font-semibold text-white">Declared constraints</h4>
      <div className="space-y-2">{Object.entries(assessment.constraints).map(([name, value]) => <div key={name} className="grid gap-2 rounded border border-white/10 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center bg-[#07192e]/60">
        <span className="font-mono text-xs text-white">{name}</span>
        <span className="break-all font-mono text-xs text-[#8d90a0]">{JSON.stringify(claim.constraints?.[name])}</span>
        <AssessmentValue value={value} />
      </div>)}</div>
    </div>}
    {assessment.diagnostics.length > 0 && <div className="mt-4"><h4 className="mb-2 text-xs font-semibold text-white">Core diagnostics</h4><ul className="space-y-1 text-xs text-[#8d90a0]">{assessment.diagnostics.map(item => <li key={item} className="font-mono text-amber-200/90">{item}</li>)}</ul></div>}
  </section>;
}

export function ClaimDetail({ claim, result, onClose }: { claim: Claim; result: LocalProjectAnalysis | ConnectedLocalProjectAnalysis; onClose: () => void }) {
  const referencedEvidence = evidenceForClaim(claim, result);
  const declarationEvidence = referencedEvidence.filter(item => item.sourceType === 'DECLARATION');
  const observedEvidence = referencedEvidence.filter(item => item.sourceType === 'STATIC');
  const connectedEvidence = referencedEvidence.filter(item => item.sourceType === 'CONNECTED');
  const runtimeEvidence = referencedEvidence.filter(item => item.sourceType === 'RUNTIME');
  const runtime = runtimePresentation(claim);
  const layers = layerSummary(claim, result);
  const resource = resourcePresentation(claim);
  const drift = hasCurrentDrift(claim);
  const snapshot = layers.latestConnected?.data?.connectedSnapshot;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-label="Claim detail">
    <div className="glass-panel max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl p-6 shadow-2xl border border-white/15">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-light">Why this result?</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-white">{claim.action || claim.predicate} <span className="font-normal text-[#8d90a0]">· {resource.label}</span></h2>
            <StateBadge state={claim.status} />
          </div>
        </div>
        <button onClick={onClose} aria-label="Close detail" className="rounded p-2 text-[#8d90a0] hover:bg-white/10 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border border-blue-400/30 bg-blue-500/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-blue-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-300">Declared</h3>
          <p className="mt-2 text-sm text-white">{layers.declared ? '✓ This capability is declared.' : '— No compatible declaration covers this capability.'}</p>
          {declarationEvidence[0] && <p className="mt-2 text-xs text-[#8d90a0]">Manifest evidence: {compactPath(declarationEvidence[0].provenance.file)}</p>}
        </section>

        <section className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-200">Observed</h3>
          <p className="mt-2 text-sm text-white">{layers.observed ? '✓ Compatible local evidence was found.' : '— No compatible local evidence is referenced.'}</p>
          {observedEvidence[0] && <p className="mt-2 text-xs text-[#8d90a0]">{compactPath(observedEvidence[0].provenance.file)}</p>}
        </section>

        <section className={`rounded-lg border p-4 relative overflow-hidden ${drift ? 'border-amber-300/40 bg-amber-300/15' : 'border-purple-400/30 bg-purple-500/10'}`}>
          <div className={`absolute top-0 left-0 bottom-0 w-1 ${drift ? 'bg-amber-400' : 'bg-purple-400'}`} />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${drift ? 'text-amber-200' : 'text-purple-200'}`}>Connected</h3>
          <p className="mt-2 text-sm text-white">{drift ? '⚠ The capability is absent from the latest accepted comparable snapshot.' : connectedEvidence.length ? '✓ The inspected source reported this capability.' : '— No connected evidence is referenced.'}</p>
          {snapshot && <p className="mt-2 text-xs text-[#8d90a0]">Observed at {new Date(snapshot.observedAt || layers.latestConnected?.observedAt).toLocaleString()} {snapshot.revision ? `· Revision ${snapshot.revision}` : ''}</p>}
        </section>

        <section className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">Runtime</h3>
          <p className="mt-2 text-sm text-white">{runtime.headline}</p>
          {runtime.outcome && <p className="mt-1 text-sm text-emerald-200 font-medium">{runtime.outcome}</p>}
          {runtime.detail && <p className="mt-2 text-xs text-[#8d90a0]">{runtime.detail}</p>}
          {claim.runtimeAssessment?.lastObservedAt && <p className="mt-1 font-mono text-xs text-[#8d90a0]">Observed {claim.runtimeAssessment.lastObservedAt}</p>}
        </section>
      </div>

      {drift && <section className="mt-4 rounded-lg border border-amber-300/40 bg-amber-300/10 p-4 shadow-sm" aria-label="What changed">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-200 flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-amber-300" /> What changed?</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded border border-amber-300/20 bg-black/20 p-3">
            <p className="text-xs text-[#8d90a0]">Previous inspection</p>
            <p className="mt-1 font-semibold text-white">{claim.action} present</p>
          </div>
          <div className="rounded border border-amber-300/20 bg-black/20 p-3">
            <p className="text-xs text-[#8d90a0]">Latest inspection</p>
            <p className="mt-1 font-semibold text-amber-200">{claim.action} absent</p>
            {snapshot?.revision && <p className="mt-1 text-xs text-[#8d90a0]">Revision {snapshot.revision}</p>}
          </div>
        </div>
        <p className="mt-3 font-semibold text-amber-100 text-xs">Current connected configuration changed.</p>
      </section>}

      <section className="mt-4 rounded-lg border border-white/10 bg-[#031427] p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2"><HelpCircle className="h-4 w-4 text-primary-light" /> What tAIdyup doesn't know</h3>
        <p className="mt-1 text-xs text-[#8d90a0]">First-class representation of system uncertainty and evidence boundaries. Unknowns reflect missing or non-exhaustive evidence, not errors or broken scans.</p>
        <ul className="mt-3 grid gap-2 text-sm text-[#8d90a0] sm:grid-cols-2">
          {(!claim.runtimeAssessment || claim.runtimeAssessment.observationState === 'NO_OBSERVATION') && <li className="flex items-start gap-2"><span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white">?</span> Whether this capability was executed.</li>}
          <li className="flex items-start gap-2"><span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white">?</span> Whether the action was authorized.</li>
          <li className="flex items-start gap-2"><span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white">?</span> Whether the downstream effect occurred.</li>
          <li className="flex items-start gap-2"><span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white">?</span> Whether the result was correct.</li>
          <li className="flex items-start gap-2"><span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white">?</span> Whether all executions were observed.</li>
          <li className="flex items-start gap-2"><span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white">?</span> Safety and compliance are not established.</li>
        </ul>
      </section>

      {claim.status === 'UNDECLARED_OBSERVATION' && <section className="mt-4 rounded-lg border border-violet-400/30 bg-violet-400/10 p-4 text-xs text-violet-100 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-violet-300 shrink-0 mt-0.5" />
        <div>This is an observed capability that is not currently covered by a reconciled declaration.</div>
      </section>}

      <details className="mt-4 rounded-lg border border-white/10 bg-[#031427] p-4 group">
        <summary className="cursor-pointer text-sm font-bold text-white flex items-center justify-between">
          <span>Technical evidence</span>
          <span className="text-xs font-mono text-primary-light font-normal group-open:hidden">Expand details →</span>
        </summary>
        <ClaimAssessment claim={claim} />
        <div className="mt-4 grid gap-3">{referencedEvidence.map(item => <EvidenceCard key={item.id} evidence={item} />)}</div>
        <details className="mt-4 rounded border border-white/10 p-3 bg-[#07192e]/60">
          <summary className="cursor-pointer text-xs font-semibold text-primary-light">Full provenance</summary>
          <div className="mt-3 space-y-2 text-xs">{claim.provenance.map((item, index) => <div key={`${item.artifact}-${index}`} className="break-all rounded border border-white/10 p-3 bg-[#031427]"><span className="font-mono text-primary-light font-bold">{item.sourceType}</span> · {item.artifact}{item.location && <> · <span className="font-mono text-white">{item.location}</span></>}{item.collectorId && <> · {item.collectorId}</>}{item.snippet && <p className="mt-2 font-mono text-violet-100 bg-[#07192e] p-2 rounded border border-white/5">{item.snippet.replaceAll(' -> ', ' → ')}</p>}</div>)}</div>
        </details>
        {resource.raw && <details className="mt-3 rounded border border-white/10 p-3 bg-[#07192e]/60">
          <summary className="cursor-pointer text-xs font-semibold text-primary-light">View raw resource</summary>
          <pre className="mt-3 whitespace-pre-wrap break-all text-xs text-[#8d90a0] font-mono bg-[#031427] p-3 rounded">{resource.raw}</pre>
        </details>}
      </details>
    </div>
  </div>;
}

function CapabilityCard({ claim, result, onOpen }: { claim: Claim; result: LocalProjectAnalysis | ConnectedLocalProjectAnalysis; onOpen: () => void }) {
  const layers = layerSummary(claim, result);
  const resource = resourcePresentation(claim);
  const drift = hasCurrentDrift(claim);
  const snapshot = layers.latestConnected?.data?.connectedSnapshot;
  const runtime = runtimePresentation(claim);
  return <article className={`rounded-xl border p-5 transition-all ${drift ? 'border-amber-300/40 bg-amber-300/5 shadow-md shadow-amber-950/20' : 'border-white/10 bg-[#07192e] hover:border-white/20'}`} data-capability-action={claim.action} data-epistemic-state={claim.status}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#8d90a0]">Capability</p>
        <h3 className="mt-1 text-2xl font-bold text-white flex items-center gap-2">{claim.action}</h3>
        <p className="mt-1 text-sm text-[#d3e4fe]">{resource.label}{resource.detail ? <span className="text-[#8d90a0]"> · {resource.detail}</span> : null}</p>
      </div>
      <StateBadge state={claim.status} />
    </div>

    {drift && <div className="mt-4 rounded-lg border border-amber-300/40 bg-amber-300/10 p-3" data-drift-outcome="CURRENT_STATE_DRIFT">
      <div className="flex items-center gap-2">
        <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-[#312000] tracking-wide">DRIFT</span>
        <p className="text-sm font-semibold text-amber-100">Current connected configuration changed.</p>
      </div>
    </div>}

    <div className="mt-4 grid gap-2 text-xs sm:grid-cols-4" aria-label="Capability evidence layers">
      <div className="rounded border border-white/10 p-3 bg-[#031427]/60">
        <p className="uppercase text-[10px] font-bold text-[#8d90a0] tracking-wider">Declared</p>
        <p className="mt-1 font-semibold text-white">{layers.declared ? '✓ Supported' : '— Not covered'}</p>
      </div>
      <div className="rounded border border-white/10 p-3 bg-[#031427]/60">
        <p className="uppercase text-[10px] font-bold text-[#8d90a0] tracking-wider">Observed</p>
        <p className="mt-1 font-semibold text-white">{layers.observed ? '✓ Supported' : '— No evidence'}</p>
      </div>
      <div className="rounded border border-white/10 p-3 bg-[#031427]/60">
        <p className="uppercase text-[10px] font-bold text-[#8d90a0] tracking-wider">Connected</p>
        <p className={`mt-1 font-semibold ${drift ? 'text-amber-100 font-bold' : 'text-white'}`}>{drift ? '⚠ Changed' : layers.connected === 'Present' ? '✓ Present' : layers.connected}</p>
        {snapshot && <p className="mt-1 text-[10px] text-[#8d90a0] font-mono">Observed {new Date(snapshot.observedAt || layers.latestConnected?.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
      </div>
      <div className="rounded border border-white/10 p-3 bg-[#031427]/60">
        <p className="uppercase text-[10px] font-bold text-[#8d90a0] tracking-wider">Runtime</p>
        <p className="mt-1 font-semibold text-white">{runtime.headline}</p>
        {runtime.outcome && <p className="mt-1 text-[10px] text-emerald-300 font-medium">{runtime.outcome}</p>}
      </div>
    </div>

    <div className="mt-4 flex justify-end">
      <button onClick={onOpen} className="rounded border border-primary/40 px-4 py-2 text-xs font-semibold text-primary-light hover:bg-primary/20 hover:border-primary transition-all shadow-sm">{drift ? 'View change / Why?' : 'Why?'}</button>
    </div>
  </article>;
}

export function AnalysisView({ state }: { state: AnalysisUiState }) {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const result = state.status === 'success' ? state.result : null;
  const claims = useMemo(() => result?.reconciliation.reconciledClaims.filter(claim => selectedSubject === 'all' || claim.subject === selectedSubject) || [], [result, selectedSubject]);

  useEffect(() => {
    setSelectedSubject('all');
    setSelectedClaim(null);
  }, [result?.project.targetPath]);

  if (state.status === 'idle') return <section className="glass-panel rounded-xl p-8 text-center shadow-lg" data-ui-state="idle">
    <Search className="mx-auto mb-3 h-10 w-10 text-primary-light opacity-80" />
    <h2 className="text-xl font-bold text-white">Select a local project</h2>
    <p className="mt-2 text-sm text-[#8d90a0] max-w-md mx-auto">Enter an existing directory containing a declared tAIdyup manifest, then run the local analysis engine.</p>
  </section>;

  if (state.status === 'loading') return <section className="glass-panel rounded-xl p-8 text-center shadow-lg" data-ui-state="loading">
    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    <h2 className="text-xl font-bold text-white">Analyzing with the Trust Kernel</h2>
    <p className="mt-2 break-all font-mono text-xs text-[#8d90a0] max-w-lg mx-auto">{state.targetPath}</p>
  </section>;

  if (state.status === 'error') return <section className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-6 shadow-lg" data-ui-state="error">
    <div className="flex gap-3">
      <AlertTriangle className="shrink-0 h-6 w-6 text-rose-300" />
      <div>
        <h2 className="text-lg font-bold text-white">Analysis not completed</h2>
        <p className="mt-1 text-sm text-rose-100">{state.message}</p>
        {state.details.length > 0 && <ul className="mt-3 list-disc pl-5 text-xs text-rose-100/90 space-y-1">{state.details.map(detail => <li key={detail}>{detail}</li>)}</ul>}
      </div>
    </div>
  </section>;

  if (!result) return null;

  const connected: ConnectedLocalProjectAnalysis['connected'] | undefined = 'connected' in result
    ? (result as ConnectedLocalProjectAnalysis).connected
    : undefined;
  const layers = {
    declared: result.evidence.filter(item => item.sourceType === 'DECLARATION').length,
    observed: result.evidence.filter(item => item.sourceType === 'STATIC').length,
    connected: result.evidence.filter(item => item.sourceType === 'CONNECTED').length,
    runtime: result.evidence.filter(item => item.sourceType === 'RUNTIME').length
  };
  const capabilities = claims.filter(claim => Boolean(claim.action));
  const otherClaims = claims.filter(claim => !claim.action);
  const attentionCount = capabilities.filter(claim => claim.status !== 'SUPPORTED').length;
  const changedCount = capabilities.filter(hasCurrentDrift).length;

  return <div className="space-y-6" data-ui-state="success">
    {/* System Overview Header */}
    <section className="glass-panel rounded-xl p-5 shadow-lg border border-white/15">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary-light">System</p>
          <h2 className="mt-1 text-3xl font-bold text-white">{result.project.name}</h2>
          <p className="mt-2 text-xs font-mono text-[#8d90a0]" title={result.project.targetPath}>{compactPath(result.project.targetPath)}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4 bg-[#031427]/80 p-4 rounded-lg border border-white/10">
          <div><p className="text-[10px] font-bold uppercase text-[#8d90a0]">Subjects</p><p className="mt-1 text-2xl font-bold text-white">{result.subjects.length}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-[#8d90a0]">Capabilities</p><p className="mt-1 text-2xl font-bold text-white">{capabilities.length}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-[#8d90a0]">Need evidence</p><p className="mt-1 text-2xl font-bold text-amber-200">{attentionCount}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-[#8d90a0]">Changed</p><p className="mt-1 text-2xl font-bold text-amber-200">{changedCount}</p></div>
        </div>
      </div>
    </section>

    {/* Reconciliation Summary Cards */}
    <section aria-label="Canonical summary">
      <h2 className="mb-3 text-sm font-bold text-white flex items-center gap-2">Reconciliation summary</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summaryStates.map(item => <article key={item.state} className="glass-panel rounded-lg p-4 transition-all hover:border-white/20" data-epistemic-state={item.state}>
          <StateBadge state={item.state} />
          <p className="mt-3 text-3xl font-bold text-white">{result.reconciliation.summary[item.key]}</p>
          <p className="mt-1 text-xs font-medium text-[#8d90a0]">{item.label}</p>
        </article>)}
      </div>
    </section>

    {/* Four Evidence Layers Banner */}
    <section className="glass-panel rounded-xl p-5 shadow-lg border border-white/15" aria-label="Evidence layers">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2"><Layers3 className="h-4 w-4 text-primary-light" /> Four Evidence Dimensions</h3>
        <span className="text-[10px] font-mono text-[#8d90a0]">Point-in-time &amp; historical evidence sources</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-blue-400/30 bg-blue-500/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-blue-500" />
          <p className="text-[10px] font-bold uppercase text-blue-300 tracking-wider">Declared</p>
          <p className="mt-1 text-2xl font-bold text-white">{layers.declared}</p>
          <p className="mt-1 text-[10px] text-[#8d90a0]">Developer manifest declarations</p>
        </div>
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-cyan-400" />
          <p className="text-[10px] font-bold uppercase text-cyan-200 tracking-wider">Observed</p>
          <p className="mt-1 text-2xl font-bold text-white">{layers.observed}</p>
          <p className="mt-1 text-[10px] text-[#8d90a0]">Static AST &amp; code evidence</p>
        </div>
        <div className="rounded-lg border border-purple-400/30 bg-purple-500/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-purple-400" />
          <p className="text-[10px] font-bold uppercase text-purple-200 tracking-wider">Connected</p>
          <p className="mt-1 text-2xl font-bold text-white">{connected ? layers.connected : 'Not inspected'}</p>
          <p className="mt-1 text-[10px] text-[#8d90a0]">Point-in-time provider snapshot</p>
        </div>
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500" />
          <p className="text-[10px] font-bold uppercase text-emerald-300 tracking-wider">Runtime</p>
          <p className="mt-1 text-2xl font-bold text-white">{layers.runtime || 'No evidence'}</p>
          <p className="mt-1 text-[10px] text-[#8d90a0]">Observed execution logs</p>
        </div>
      </div>
      {connected && <div className="mt-4 rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-xs">
        <p className="font-bold text-amber-100 flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-300" /> Latest inspected snapshot</p>
        <p className="mt-1 font-mono text-amber-100/90">n8n · {connected.snapshot.sourceInstance} · observed at {connected.snapshot.observedAt} · {connected.snapshot.retrievalStatus} · {connected.snapshot.completeness}{connected.snapshot.revision ? ` · revision ${connected.snapshot.revision}` : ''}</p>
        {connected.absenceEvidences.length > 0 && <p className="mt-2 font-semibold text-amber-200">Current connected configuration changed. {connected.absenceEvidences.length} scoped absence observation(s) accepted by the Trust Kernel.</p>}
        {connected.diagnostics.length > 0 && <ul className="mt-2 space-y-1 font-mono text-amber-100/80">{connected.diagnostics.map(item => <li key={item}>{item}</li>)}</ul>}
      </div>}
    </section>

    {/* Authority Explorer & Capabilities Grid */}
    <section className="glass-panel rounded-xl p-5 shadow-lg border border-white/15" aria-label="Authority explorer">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-light">Authority explorer</p>
          <h2 className="mt-1 text-2xl font-bold text-white">Capabilities</h2>
          <p className="mt-1 text-xs text-[#8d90a0]">Conclusion first. Open Why? for explanation and technical proof.</p>
        </div>
        <select value={selectedSubject} onChange={event => setSelectedSubject(event.target.value)} className="rounded-md border border-white/15 bg-[#031427] px-3 py-2 text-xs text-white font-medium outline-none focus:border-primary">
          <option value="all">All subjects</option>
          {result.subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
        </select>
      </div>

      {capabilities.length === 0 ? <div className="rounded-lg border border-dashed border-white/15 p-8 text-center text-sm text-[#8d90a0]" data-ui-state="empty">No reconciled capabilities for this selection.</div> : <div className="grid gap-4 lg:grid-cols-2">{capabilities.map(claim => <CapabilityCard key={claim.id} claim={claim} result={result} onOpen={() => setSelectedClaim(claim)} />)}</div>}

      {otherClaims.length > 0 && <details className="mt-5 rounded-lg border border-white/10 bg-[#031427] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-white">Other claims and declarations <span className="ml-2 text-[#8d90a0] font-mono text-xs">{otherClaims.length}</span></summary>
        <div className="mt-3 space-y-2">{otherClaims.map(claim => <button key={claim.id} onClick={() => setSelectedClaim(claim)} className="flex w-full items-center justify-between gap-3 rounded border border-white/10 p-3 text-left text-xs hover:bg-white/5 transition-colors"><span><span className="font-mono text-white font-semibold">{claim.predicate}</span><span className="ml-2 text-[#8d90a0]">{claim.subject}</span></span><StateBadge state={claim.status} /></button>)}</div>
      </details>}
    </section>

    {/* Unbound Runtime Observations */}
    {result.reconciliation.unboundRuntimeObservations?.length ? <section className="glass-panel rounded-xl p-5 shadow-lg border border-white/15" aria-label="Unbound runtime observations">
      <div className="flex items-center gap-2 mb-1">
        <Terminal className="h-5 w-5 text-amber-300" />
        <h2 className="font-bold text-white text-lg">Unbound runtime observations</h2>
      </div>
      <p className="text-xs text-[#8d90a0]">Runtime activity was observed, but no evidence-backed subject binding allows attribution to a specific agent.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{result.reconciliation.unboundRuntimeObservations.map(item => <EvidenceCard key={item.id} evidence={item} />)}</div>
    </section> : null}

    {/* Technical Findings */}
    {result.reconciliation.findings.length === 0 ? <details className="glass-panel rounded-xl p-4" aria-label="Technical findings">
      <summary className="cursor-pointer text-sm font-semibold text-white">Technical findings <span className="ml-2 font-normal text-[#8d90a0]">None emitted</span></summary>
    </details> : <section className="glass-panel rounded-xl p-5 shadow-lg border border-white/15" aria-label="Technical findings">
      <h2 className="mb-4 font-bold text-white text-lg">Technical findings</h2>
      <div className="space-y-3">{result.reconciliation.findings.map(finding => <article key={finding.id} className="rounded-lg border border-white/10 bg-[#07192e] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-white">{finding.title}</h3><span className="rounded border border-white/15 px-2 py-1 font-mono text-[10px] text-amber-200">{finding.severity}</span></div><p className="mt-2 text-xs text-[#8d90a0]">{finding.description}</p>{finding.type === 'UNDECLARED_CRITICAL_CAPABILITY' && <p className="mt-3 rounded border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-100">Critical refers to the authority involved and the fact that it is not covered by a fully reconciled declaration. This finding does not by itself indicate a security vulnerability.</p>}<details className="mt-3"><summary className="cursor-pointer text-xs text-primary-light font-semibold">Finding provenance</summary><p className="mt-2 break-all font-mono text-[10px] text-primary-light bg-[#031427] p-2 rounded border border-white/5">{finding.provenance.file}{finding.provenance.location ? ` · ${finding.provenance.location}` : ''}</p></details></article>)}</div>
    </section>}

    {/* Evidence Inspector */}
    <details className="glass-panel rounded-xl p-5 shadow-lg border border-white/15">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <FileCode2 className="text-primary-light h-5 w-5" />
        <span className="font-bold text-white text-lg">Evidence inspector</span>
        <span className="text-xs font-mono text-[#8d90a0]">{result.evidence.length} records · technical details</span>
      </summary>
      <p className="mt-3 text-xs text-[#8d90a0]">Declared, local observed, and explicitly inspected CONNECTED evidence remain distinguishable.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{result.evidence.map(item => <EvidenceCard key={item.id} evidence={item} />)}</div>
      {result.evidence.length === 0 && <p className="mt-4 text-sm text-[#8d90a0]">No evidence was emitted.</p>}
    </details>

    {/* Epistemic Non-Negotiable Semantic Rule Footer */}
    <section className="rounded-lg border border-white/10 bg-[#07192e] p-4 text-xs text-[#8d90a0] leading-relaxed shadow-sm">
      <div className="flex items-start gap-2">
        <Layers3 className="mt-0.5 inline h-4 w-4 shrink-0 text-primary-light" />
        <div>
          <span className="font-semibold text-white">Epistemic Model Guarantee: </span>
          Supported means compatible declaration and evidence under current Core rules. CONNECTED reports configuration at an observed time; it does not establish execution, authorization, safety, or compliance. Unknown is not failure; unverified is not false.
        </div>
      </div>
    </section>

    {/* Modal Detail view */}
    {selectedClaim && <ClaimDetail claim={selectedClaim} result={result} onClose={() => setSelectedClaim(null)} />}
  </div>;
}
