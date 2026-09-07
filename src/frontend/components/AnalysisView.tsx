import { AlertTriangle, FileCode2, Layers3, Search, X, HelpCircle, ArrowRightLeft, Shield, CheckCircle2, AlertCircle, HelpCircle as QuestionIcon, Terminal, Code2 } from 'lucide-react';
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
  if (!runtime || runtime.observationState === 'NO_OBSERVATION') return { headline: 'No runtime evidence available', detail: 'No runtime evidence is not evidence of no execution.' };
  const headline = runtime.observationState === 'ATTEMPT_OBSERVED' ? 'Execution attempt observed (RUNTIME_SOURCE_EVIDENCE)' : runtime.observationState === 'START_OBSERVED' ? 'Execution start observed (RUNTIME_SOURCE_EVIDENCE)' : runtime.observationState === 'COMPLETION_OBSERVED' ? 'Completion observed (RUNTIME_SOURCE_EVIDENCE)' : 'Result observation reported (RUNTIME_SOURCE_EVIDENCE)';
  const outcome = runtime.latestOutcome === 'SUCCEEDED' ? 'Source reported success (does not establish result correctness)' : runtime.latestOutcome === 'FAILED' ? 'Source reported failure' : runtime.latestOutcome === 'UNKNOWN' ? 'Source reported unknown outcome' : undefined;
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
    connected: absence.length ? 'Changed · absent in latest snapshot' : connected.length ? 'Present' : ('connected' in result ? 'No supporting evidence' : 'Current configuration remains unknown'),
    latestConnected
  };
}

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  const snapshot = evidence.data?.connectedSnapshot;
  const workflow = evidence.data?.workflowProvenance;
  const runtime = evidence.sourceType === 'RUNTIME' ? evidence.data : undefined;
  return <article className="rounded-md border border-[#1A1D20]/15 bg-white p-4 text-xs shadow-2xs hover:border-[#1E50C8]/40 transition-all" data-source-type={evidence.sourceType}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#1A1D20]/10 pb-2">
      <span className="font-mono text-[#1E50C8] font-bold">{evidence.id}</span>
      <span className="rounded border border-[#1A1D20]/15 bg-[#F2EFE9] px-2 py-0.5 font-mono text-[10px] font-bold text-[#1A1D20]">{evidence.sourceType}</span>
    </div>
    <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5">
      <dt className="text-[#5C6068] font-medium">Type</dt><dd className="text-[#1A1D20] font-semibold">{evidence.type}</dd>
      <dt className="text-[#5C6068] font-medium">Strength</dt><dd className="font-mono text-[#0D7490] font-semibold">{evidence.sourceType === 'RUNTIME' && evidence.strength === 'RUNTIME_CONFIRMED' ? 'RUNTIME_SOURCE_EVIDENCE' : evidence.strength}</dd>
      <dt className="text-[#5C6068] font-medium">Collector</dt><dd className="text-[#1A1D20]">{evidence.collectorId} {evidence.collectorVersion}</dd>
      <dt className="text-[#5C6068] font-medium">Artifact</dt><dd className="break-all font-mono text-[#1E50C8]">{evidence.artifact}</dd>
      <dt className="text-[#5C6068] font-medium">File</dt><dd className="break-all font-mono text-[#1A1D20]">{evidence.provenance.file}</dd>
      {evidence.location && <><dt className="text-[#5C6068] font-medium">Location</dt><dd className="font-mono text-[#1A1D20]">{evidence.location}</dd></>}
      {snapshot && <><dt className="text-[#5C6068] font-medium">Observed at</dt><dd className="font-mono text-[#1A1D20]">{snapshot.observedAt || evidence.observedAt}</dd><dt className="text-[#5C6068] font-medium">Snapshot</dt><dd className="font-mono text-[#1A1D20]">{snapshot.retrievalStatus} · {snapshot.completeness}</dd>{snapshot.revision && <><dt className="text-[#5C6068] font-medium">Revision</dt><dd className="break-all font-mono text-[#1A1D20]">{snapshot.revision}</dd></>}</>}
      {workflow?.graph && <><dt className="text-[#5C6068] font-medium">Relation</dt><dd className="font-mono text-[#6D28D9]">{workflow.graph.fromNodeId} → {workflow.graph.toNodeId} · {workflow.graph.relation}</dd></>}
      {evidence.data?.observation === 'ABSENCE_OBSERVED' && <><dt className="text-[#5C6068] font-medium">Observation</dt><dd className="font-mono text-[#B45309] font-bold">ABSENCE_OBSERVED</dd></>}
      {runtime && <><dt className="text-[#5C6068] font-medium">Lifecycle</dt><dd className="font-mono text-[#1A1D20]">{runtime.eventKind}</dd>{runtime.outcome && <><dt className="text-[#5C6068] font-medium">Source outcome</dt><dd className="font-mono text-[#1A1D20]">{runtime.outcome}</dd></>}<dt className="text-[#5C6068] font-medium">Coverage</dt><dd className="font-mono text-[#1A1D20]">{runtime.completeness}</dd><dt className="text-[#5C6068] font-medium">Subject binding</dt><dd className="font-mono text-[#1A1D20]">{runtime.bindings?.subject?.state || 'UNBOUND'}</dd><dt className="text-[#5C6068] font-medium">Event time</dt><dd className="font-mono text-[#1A1D20]">{runtime.eventTime || evidence.observedAt}</dd></>}
    </dl>
  </article>;
}

function unknownsForClaim(claim: Claim, result: LocalProjectAnalysis | ConnectedLocalProjectAnalysis): string[] {
  const runtimeObserved = Boolean(claim.runtimeAssessment && claim.runtimeAssessment.observationState !== 'NO_OBSERVATION');
  const evidence = evidenceForClaim(claim, result);
  return Array.from(new Set([
    ...(runtimeObserved ? [] : ['Whether execution activity occurred outside the available runtime evidence.']),
    ...(claim.assessment?.binding === 'UNBOUND' ? ['Whether the observed component is the declared subject.'] : []),
    ...(evidence.some(item => item.sourceType === 'CONNECTED') ? [] : ['Whether the capability is currently configured in a connected source.']),
    'Whether the action was authorized.',
    ...(runtimeObserved ? ['Whether the downstream effect occurred.', 'Whether the result was correct.'] : []),
    'Whether all executions were observed.',
    'Safety and compliance are not established.'
  ]));
}

function conclusionForClaim(claim: Claim, drift: boolean): string {
  if (drift) return 'Current comparable CONNECTED evidence no longer supports the previous state; historical runtime evidence remains historical.';
  if (claim.status === 'SUPPORTED') return 'Compatible declaration and technical evidence support this capability under current Core rules.';
  if (claim.status === 'CONFLICT') return 'Available evidence conflicts with the explicit declaration. This does not establish authorization, legality, safety, or compliance.';
  if (claim.status === 'UNDECLARED_OBSERVATION') return 'Capability activity was observed without a compatible reconciled declaration.';
  return 'Available evidence is insufficient to support the full capability claim.';
}

function AssessmentValue({ value }: { value: string }) {
  return <span className="inline-flex rounded border border-[#1A1D20]/15 bg-[#F2EFE9] px-2 py-0.5 font-mono text-[10px] font-bold text-[#1A1D20] tracking-wide">{value}</span>;
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

  return <section className="mt-4 rounded-lg border border-[#1A1D20]/15 bg-white p-4" aria-label="Dimensional assessment">
    <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D20]">Why this result</h3>
    {coreObserved && <div className="mt-3 rounded-md border border-[#1E50C8]/30 bg-[#1E50C8]/10 p-3">
      <p className="text-sm font-bold text-[#1E50C8] flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-[#1E50C8]" /> Core capability observed</p>
      <p className="mt-1 text-xs text-[#5C6068]">Static evidence supports the core action dimension. This does not make the full declaration supported.</p>
    </div>}
    <div className="mt-4 grid gap-2">
      {dimensions.map(([label, value]) => <div key={label} className="rounded border border-[#1A1D20]/10 p-3 bg-[#F9F8F5]">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-[#1A1D20]">{label === 'Subject' ? 'Subject binding' : label}</span><AssessmentValue value={value} /></div>
        <p className="mt-2 text-xs text-[#5C6068]">{dimensionExplanation(label, value)}</p>
      </div>)}
      <div className="rounded border border-[#1A1D20]/10 p-3 bg-[#F9F8F5]">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-[#1A1D20]">Resource relation</span><AssessmentValue value={assessment.resourceRelation} /></div>
        <p className="mt-2 text-xs text-[#5C6068]">This relation is reported by the Core; the UI does not infer equivalence from similar labels.</p>
      </div>
      <div className="rounded border border-[#1A1D20]/10 p-3 bg-[#F9F8F5]">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-[#1A1D20]">Binding</span><AssessmentValue value={assessment.binding} /></div>
        <p className="mt-2 text-xs text-[#5C6068]">{assessment.binding === 'UNBOUND' ? 'No evidence-backed subject binding is available for this claim.' : `Binding assessment reported by the Core: ${assessment.binding}.`}</p>
      </div>
    </div>
    {Object.keys(assessment.constraints).length > 0 && <div className="mt-4">
      <h4 className="mb-2 text-xs font-semibold text-[#1A1D20]">Declared constraints</h4>
      <div className="space-y-2">{Object.entries(assessment.constraints).map(([name, value]) => <div key={name} className="grid gap-2 rounded border border-[#1A1D20]/10 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center bg-[#F9F8F5]">
        <span className="font-mono text-xs text-[#1A1D20]">{name}</span>
        <span className="break-all font-mono text-xs text-[#5C6068]">{JSON.stringify(claim.constraints?.[name])}</span>
        <AssessmentValue value={value} />
      </div>)}</div>
    </div>}
    {assessment.diagnostics.length > 0 && <div className="mt-4"><h4 className="mb-2 text-xs font-semibold text-[#1A1D20]">Core diagnostics</h4><ul className="space-y-1 text-xs text-[#5C6068]">{assessment.diagnostics.map(item => <li key={item} className="font-mono text-[#B45309]">{item}</li>)}</ul></div>}
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
  const unknowns = unknownsForClaim(claim, result);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1D20]/60 p-4 backdrop-blur-sm" role="dialog" aria-label="Claim detail">
    <div className="workbench-card max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl p-6 shadow-2xl border border-[#1A1D20]/20 bg-[#F6F3EC]">
      {/* Top Title & Epistemic Status */}
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#1A1D20]/15 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1E50C8]">Why this result?</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-[#1A1D20] heading-font">{claim.action || claim.predicate} <span className="font-normal text-[#5C6068]">· {resource.label}</span></h2>
            <StateBadge state={claim.status} />
          </div>
        </div>
        <button onClick={onClose} aria-label="Close detail" className="rounded p-2 text-[#5C6068] hover:bg-[#1A1D20]/10 hover:text-[#1A1D20] transition-colors"><X className="h-5 w-5" /></button>
      </div>

      {/* 4 Evidence Dimensions Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border border-[#1E50C8]/30 bg-[#1E50C8]/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#1E50C8]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E50C8]">Declared</h3>
          <p className="mt-2 text-sm font-semibold text-[#1A1D20]">{layers.declared ? '✓ Declared capability' : '— No declaration covers this'}</p>
          {declarationEvidence[0] && <p className="mt-2 text-xs text-[#5C6068]">Manifest: {compactPath(declarationEvidence[0].provenance.file)}</p>}
        </section>

        <section className="rounded-lg border border-[#0D7490]/30 bg-[#0D7490]/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#0D7490]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#0D7490]">Observed</h3>
          <p className="mt-2 text-sm font-semibold text-[#1A1D20]">{layers.observed ? '✓ Available local technical evidence found' : '— No local technical evidence'}</p>
          {observedEvidence[0] && <p className="mt-2 text-xs text-[#5C6068]">{compactPath(observedEvidence[0].provenance.file)}</p>}
        </section>

        <section className={`rounded-lg border p-4 relative overflow-hidden ${drift ? 'border-[#D97706]/40 bg-[#FFFBEB]' : 'border-[#6D28D9]/30 bg-[#6D28D9]/10'}`}>
          <div className={`absolute top-0 left-0 bottom-0 w-1 ${drift ? 'bg-[#D97706]' : 'bg-[#6D28D9]'}`} />
          <h3 className={`text-xs font-bold uppercase tracking-wider ${drift ? 'text-[#B45309]' : 'text-[#6D28D9]'}`}>Connected</h3>
          <p className="mt-2 text-sm font-semibold text-[#1A1D20]">{drift ? '⚠ Absent from latest comparable snapshot' : connectedEvidence.length ? '✓ Connected provider reported this capability' : '— No connected evidence'}</p>
          {snapshot && <p className="mt-2 text-xs text-[#5C6068]">Observed {new Date(snapshot.observedAt || layers.latestConnected?.observedAt).toLocaleString()} {snapshot.revision ? `· Revision ${snapshot.revision}` : ''}</p>}
        </section>

        <section className="rounded-lg border border-[#059669]/30 bg-[#059669]/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#059669]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#059669]">Runtime</h3>
          <p className="mt-2 text-sm font-semibold text-[#1A1D20]">{runtime.headline}</p>
          {runtime.outcome && <p className="mt-1 text-sm text-[#059669] font-bold">{runtime.outcome}</p>}
          {runtime.detail && <p className="mt-2 text-xs text-[#5C6068]">{runtime.detail}</p>}
          {claim.runtimeAssessment?.lastObservedAt && <p className="mt-1 font-mono text-xs text-[#5C6068]">Observed {claim.runtimeAssessment.lastObservedAt}</p>}
        </section>
      </div>

      {/* Connected Drift Section */}
      {drift && <section className="mt-4 rounded-lg border border-[#D97706]/40 bg-[#FFFBEB] p-4 shadow-2xs" aria-label="What changed">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#B45309] flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-[#B45309]" /> What changed?</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded border border-[#D97706]/20 bg-white p-3">
            <p className="text-xs text-[#5C6068]">Previous inspection</p>
            <p className="mt-1 font-bold text-[#1A1D20]">{claim.action} present</p>
          </div>
          <div className="rounded border border-[#D97706]/20 bg-white p-3">
            <p className="text-xs text-[#5C6068]">Latest inspection</p>
            <p className="mt-1 font-bold text-[#B45309]">{claim.action} absent</p>
            {snapshot?.revision && <p className="mt-1 text-xs text-[#5C6068]">Revision {snapshot.revision}</p>}
          </div>
        </div>
        <p className="mt-3 font-bold text-[#B45309] text-xs">Current connected configuration changed.</p>
      </section>}

      {/* Explicit CANNOT Conflict Banner */}
      {claim.status === 'CONFLICT' && <section className="mt-4 rounded-lg border border-[#DC2626]/40 bg-[#FEF2F2] p-4 text-xs text-[#B91C1C] flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-[#B91C1C] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Observed runtime activity conflicts with an explicit declaration.</span>
          <p className="mt-1 text-[#5C6068]">This reflects a dimensional reconciliation conflict between declared manifest constraints and observed activity.</p>
        </div>
      </section>}

      <section className="mt-4 rounded-lg border border-[#1A1D20]/15 bg-white p-4" aria-label="Conclusion">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D20]">Conclusion</h3>
        <p className="mt-2 text-sm text-[#1A1D20]">{conclusionForClaim(claim, drift)}</p>
      </section>

      {/* Knowledge Boundary: What tAIdyup doesn't know */}
      <section className="mt-4 rounded-lg border border-[#1A1D20]/15 bg-white p-4" data-tour-anchor="why-unknowns">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D20] flex items-center gap-2"><HelpCircle className="h-4 w-4 text-[#1E50C8]" /> What tAIdyup doesn't know</h3>
        <p className="mt-1 text-xs text-[#5C6068]">First-class representation of system uncertainty and evidence boundaries. Unknowns reflect missing or non-exhaustive evidence, not errors or broken scans.</p>
        <ul className="mt-3 grid gap-2 text-sm text-[#5C6068] sm:grid-cols-2">{unknowns.map(item => <li key={item} className="flex items-start gap-2"><span className="rounded-full bg-[#1A1D20]/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#1A1D20]">?</span> {item}</li>)}</ul>
      </section>

      {claim.status === 'UNDECLARED_OBSERVATION' && <section className="mt-4 rounded-lg border border-[#6D28D9]/30 bg-[#F5F3FF] p-4 text-xs text-[#6D28D9] flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-[#6D28D9] shrink-0 mt-0.5" />
        <div>{result.manifest?.status === 'ABSENT' ? 'Observed capability. No compatible owner declaration was supplied.' : 'Observed capability that is not currently covered by a reconciled declaration.'}</div>
      </section>}

      {/* Dark Technical Proof / CLI Evidence Drawer */}
      <details className="mt-4 rounded-lg dark-proof-drawer p-5 group shadow-lg">
        <summary className="cursor-pointer text-sm font-bold text-white flex items-center justify-between heading-font">
          <span className="flex items-center gap-2"><Terminal className="h-4 w-4 text-[#34D399]" /> Technical evidence</span>
          <span className="text-xs font-mono text-[#60A5FA] font-normal group-open:hidden">Expand CLI Drawer →</span>
        </summary>
        <ClaimAssessment claim={claim} />
        <div className="mt-4 grid gap-3">{referencedEvidence.map(item => <EvidenceCard key={item.id} evidence={item} />)}</div>
        <details className="mt-4 rounded border border-white/10 p-3 bg-[#0D0E10]">
          <summary className="cursor-pointer text-xs font-semibold text-[#60A5FA]">Full provenance</summary>
          <div className="mt-3 space-y-2 text-xs">{claim.provenance.map((item, index) => <div key={`${item.artifact}-${index}`} className="break-all rounded border border-white/10 p-3 bg-[#1A1D20] text-white"><span className="font-mono text-[#60A5FA] font-bold">{item.sourceType}</span> · {item.artifact}{item.location && <> · <span className="font-mono text-emerald-300">{item.location}</span></>}{item.collectorId && <> · {item.collectorId}</>}{item.snippet && <p className="mt-2 font-mono text-emerald-300 bg-[#0D0E10] p-2 rounded border border-white/10">{item.snippet.replaceAll(' -> ', ' → ')}</p>}</div>)}</div>
        </details>
        {resource.raw && <details className="mt-3 rounded border border-white/10 p-3 bg-[#0D0E10]">
          <summary className="cursor-pointer text-xs font-semibold text-[#60A5FA]">View raw resource</summary>
          <pre className="mt-3 whitespace-pre-wrap break-all text-xs text-emerald-300 font-mono bg-[#1A1D20] p-3 rounded border border-white/10">{resource.raw}</pre>
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
  const tourAnchor = claim.action === 'SEND' ? 'supported-runtime' : claim.action === 'WRITE' ? 'interesting-difference' : undefined;

  return <article className={`workbench-card workbench-card-hover p-5 relative overflow-hidden ${drift ? 'border-[#D97706]/40 bg-[#FFFBEB]' : ''}`} data-capability-action={claim.action} data-epistemic-state={claim.status} data-tour-anchor={tourAnchor}>
    <div className="h-1 wood-header-strip absolute top-0 left-0 right-0" />
    <div className="flex flex-wrap items-start justify-between gap-4 pt-1">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#5C6068]">Capability</p>
        <h3 className="mt-1 text-2xl font-bold text-[#1A1D20] flex items-center gap-2 heading-font">{claim.action}</h3>
        <p className="mt-1 text-sm text-[#1A1D20]">{resource.label}{resource.detail ? <span className="text-[#5C6068]"> · {resource.detail}</span> : null}</p>
      </div>
      <StateBadge state={claim.status} />
    </div>

    {drift && <div className="mt-4 rounded-md border border-[#D97706]/40 bg-[#FEF3C7] p-3" data-drift-outcome="CURRENT_STATE_DRIFT">
      <div className="flex items-center gap-2">
        <span className="rounded bg-[#B45309] px-2 py-0.5 text-[10px] font-bold text-white tracking-wide">DRIFT</span>
        <p className="text-xs font-bold text-[#B45309]">Current connected configuration changed.</p>
      </div>
    </div>}

    <div className="mt-4 grid gap-2 text-xs sm:grid-cols-4" aria-label="Capability evidence layers">
      <div className="rounded border border-[#1A1D20]/10 p-2.5 bg-[#F9F8F5]">
        <p className="uppercase text-[9px] font-bold text-[#1E50C8] tracking-wider">Declared</p>
        <p className="mt-1 font-bold text-[#1A1D20]">{layers.declared ? '✓ Declared' : '— Not covered'}</p>
      </div>
      <div className="rounded border border-[#1A1D20]/10 p-2.5 bg-[#F9F8F5]">
        <p className="uppercase text-[9px] font-bold text-[#0D7490] tracking-wider">Observed</p>
        <p className="mt-1 font-bold text-[#1A1D20]">{layers.observed ? '✓ Code evidence' : '— No evidence'}</p>
      </div>
      <div className="rounded border border-[#1A1D20]/10 p-2.5 bg-[#F9F8F5]">
        <p className="uppercase text-[9px] font-bold text-[#6D28D9] tracking-wider">Connected</p>
        <p className={`mt-1 font-bold ${drift ? 'text-[#B45309]' : 'text-[#1A1D20]'}`}>{drift ? '⚠ Changed' : layers.connected === 'Present' ? '✓ Present' : layers.connected}</p>
        {snapshot && <p className="mt-1 text-[9px] text-[#5C6068] font-mono">Observed {new Date(snapshot.observedAt || layers.latestConnected?.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
      </div>
      <div className="rounded border border-[#1A1D20]/10 p-2.5 bg-[#F9F8F5]">
        <p className="uppercase text-[9px] font-bold text-[#059669] tracking-wider">Runtime</p>
        <p className="mt-1 font-bold text-[#1A1D20]">{runtime.headline}</p>
        {runtime.outcome && <p className="mt-1 text-[9px] text-[#059669] font-bold">{runtime.outcome}</p>}
      </div>
    </div>

    <div className="mt-4 flex justify-end">
      <button onClick={onOpen} className="rounded border border-[#1E50C8]/40 bg-[#1E50C8]/10 px-4 py-1.5 text-xs font-bold text-[#1E50C8] hover:bg-[#1E50C8] hover:text-white transition-all shadow-2xs cursor-pointer min-h-[44px]">{drift ? 'View change / Why?' : 'Why?'}</button>
    </div>
  </article>;
}

export function AnalysisView({ state, onStartTour, tourStep }: { state: AnalysisUiState; onStartTour?: () => void; tourStep?: number }) {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const result = state.status === 'success' ? state.result : null;
  const claims = useMemo(() => result?.reconciliation.reconciledClaims.filter(claim => selectedSubject === 'all' || claim.subject === selectedSubject) || [], [result, selectedSubject]);

  useEffect(() => {
    setSelectedSubject('all');
    setSelectedClaim(null);
  }, [result?.project.targetPath]);

  useEffect(() => {
    if (tourStep === 4 && (result as any)?.presentation?.bundledDemo === true) {
      setSelectedClaim(result?.reconciliation.reconciledClaims.find(claim => claim.action === 'SEND' && claim.status === 'SUPPORTED') || null);
    } else if (tourStep !== undefined) {
      setSelectedClaim(null);
    }
  }, [result, tourStep]);

  if (state.status === 'idle') return <section className="workbench-card p-8 text-center shadow-md border border-[#1A1D20]/15" data-ui-state="idle">
    <Search className="mx-auto mb-3 h-10 w-10 text-[#1E50C8] opacity-80" />
    <h2 className="text-xl font-bold text-[#1A1D20] heading-font">Select a local project</h2>
    <p className="mt-2 text-xs text-[#5C6068] max-w-md mx-auto">Enter an absolute path containing your code, then run local inspection.</p>
  </section>;

  if (state.status === 'loading') return <section className="workbench-card p-8 text-center shadow-md border border-[#1A1D20]/15" data-ui-state="loading">
    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#1E50C8] border-t-transparent" />
    <h2 className="text-xl font-bold text-[#1A1D20] heading-font">Reconciling with the Trust Kernel</h2>
    <p className="mt-2 break-all font-mono text-xs text-[#5C6068] max-w-lg mx-auto">{state.targetPath}</p>
  </section>;

  if (state.status === 'error') return <section className="rounded-xl border border-rose-400/40 bg-rose-50 p-6 shadow-md" data-ui-state="error">
    <div className="flex gap-3">
      <AlertTriangle className="shrink-0 h-6 w-6 text-rose-600" />
      <div>
        <h2 className="text-lg font-bold text-[#1A1D20]">Analysis not completed</h2>
        <p className="mt-1 text-xs text-rose-900">{state.message}</p>
        {state.details.length > 0 && <ul className="mt-3 list-disc pl-5 text-xs text-rose-800 space-y-1">{state.details.map(detail => <li key={detail}>{detail}</li>)}</ul>}
      </div>
    </div>
  </section>;

  if (!result) return null;

  const isBundledDemo = (result as any).presentation?.bundledDemo === true;
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
    {/* Manifest ABSENT Calm Informational State */}
    {result.manifest?.status === 'ABSENT' && (
      <section className="workbench-panel p-4 rounded-lg border border-[#1E50C8]/30 bg-[#1E50C8]/5 text-xs" data-manifest-status="ABSENT">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-[#1E50C8] shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-[#1A1D20] text-sm">No tAIdyup declarations supplied</h3>
            <p className="mt-1 text-[#5C6068]">
              Technical evidence was analyzed, but no owner declaration source was provided for this project. Observed capabilities are not owner declarations or authorization.
            </p>
          </div>
        </div>
      </section>
    )}

    {/* System Overview Header Panel */}
    <section className="workbench-card p-6 shadow-md border border-[#1A1D20]/15" data-tour-anchor="project">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1E50C8]">System</p>
            {isBundledDemo && (
              <span className="rounded border border-[#1E50C8]/30 bg-[#1E50C8]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#1E50C8]">
                {(result as any).presentation?.label || 'Bundled onboarding demo'}
              </span>
            )}
          </div>
          <h2 className="mt-1 text-3xl font-bold text-[#1A1D20] heading-font">{result.project.name}</h2>
          <p className="mt-2 text-xs font-mono text-[#5C6068]" title={result.project.targetPath}>{compactPath(result.project.targetPath)}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4 workbench-panel p-4 rounded-lg">
          <div><p className="text-[10px] font-bold uppercase text-[#5C6068]">Subjects</p><p className="mt-1 text-2xl font-bold text-[#1A1D20] heading-font">{result.subjects.length}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-[#5C6068]">Capabilities</p><p className="mt-1 text-2xl font-bold text-[#1A1D20] heading-font">{capabilities.length}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-[#5C6068]">Need evidence</p><p className="mt-1 text-2xl font-bold text-[#B45309] heading-font">{attentionCount}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-[#5C6068]">Changed</p><p className="mt-1 text-2xl font-bold text-[#B45309] heading-font">{changedCount}</p></div>
        </div>
      </div>
    </section>

    {/* Reconciliation Factual Summary Cards (NO 0-100 Synthetic Scores) */}
    <section aria-label="Canonical summary">
      <h2 className="mb-3 text-sm font-bold text-[#1A1D20] flex items-center gap-2 heading-font">Reconciliation summary</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {summaryStates.map(item => <article key={item.state} className="workbench-card p-4 transition-all hover:border-[#1E50C8]/40" data-epistemic-state={item.state}>
          <StateBadge state={item.state} />
          <p className="mt-3 text-3xl font-bold text-[#1A1D20] heading-font">{result.reconciliation.summary[item.key]}</p>
          <p className="mt-1 text-xs font-medium text-[#5C6068]">{item.label}</p>
        </article>)}
      </div>
    </section>

    {/* Four Evidence Layers Banner */}
    <section className="workbench-card p-5 shadow-md border border-[#1A1D20]/15" aria-label="Evidence layers" data-tour-anchor="layers">
      <div className="mb-3 flex items-center justify-between border-b border-[#1A1D20]/10 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D20] flex items-center gap-2 heading-font"><Layers3 className="h-4 w-4 text-[#1E50C8]" /> Four Evidence Dimensions</h3>
        <span className="text-[10px] font-mono text-[#5C6068]">Point-in-time &amp; historical evidence sources</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[#1E50C8]/30 bg-[#1E50C8]/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#1E50C8]" />
          <p className="text-[10px] font-bold uppercase text-[#1E50C8] tracking-wider">Declared</p>
          <p className="mt-1 text-2xl font-bold text-[#1A1D20] heading-font">{layers.declared}</p>
          <p className="mt-1 text-[10px] text-[#5C6068]">{result.manifest?.status === 'ABSENT' ? 'No declarations supplied' : 'Developer manifest declarations'}</p>
        </div>
        <div className="rounded-lg border border-[#0D7490]/30 bg-[#0D7490]/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#0D7490]" />
          <p className="text-[10px] font-bold uppercase text-[#0D7490] tracking-wider">Observed</p>
          <p className="mt-1 text-2xl font-bold text-[#1A1D20] heading-font">{layers.observed}</p>
          <p className="mt-1 text-[10px] text-[#5C6068]">Source and workflow evidence</p>
        </div>
        <div className="rounded-lg border border-[#6D28D9]/30 bg-[#6D28D9]/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#6D28D9]" />
          <p className="text-[10px] font-bold uppercase text-[#6D28D9] tracking-wider">Connected</p>
          <p className="mt-1 text-2xl font-bold text-[#1A1D20] heading-font">{connected ? layers.connected : 'Not inspected'}</p>
          <p className="mt-1 text-[10px] text-[#5C6068]">Point-in-time provider snapshot</p>
        </div>
        <div className="rounded-lg border border-[#059669]/30 bg-[#059669]/10 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#059669]" />
          <p className="text-[10px] font-bold uppercase text-[#059669] tracking-wider">Runtime</p>
          <p className="mt-1 text-2xl font-bold text-[#1A1D20] heading-font">{layers.runtime || 'No evidence'}</p>
          <p className="mt-1 text-[10px] text-[#5C6068]">Available runtime evidence</p>
        </div>
      </div>
      {connected && <div className="mt-4 rounded-lg border border-[#D97706]/30 bg-[#FFFBEB] p-3 text-xs">
        <p className="font-bold text-[#B45309] flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#B45309]" /> Latest inspected snapshot</p>
        <p className="mt-1 font-mono text-[#1A1D20]">n8n · {connected.snapshot.sourceInstance} · observed at {connected.snapshot.observedAt} · {connected.snapshot.retrievalStatus} · {connected.snapshot.completeness}{connected.snapshot.revision ? ` · revision ${connected.snapshot.revision}` : ''}</p>
        {connected.absenceEvidences.length > 0 && <p className="mt-2 font-bold text-[#B45309]">Current connected configuration changed. {connected.absenceEvidences.length} scoped absence observation(s) accepted by the Trust Kernel.</p>}
        {connected.diagnostics.length > 0 && <ul className="mt-2 space-y-1 font-mono text-[#5C6068]">{connected.diagnostics.map(item => <li key={item}>{item}</li>)}</ul>}
      </div>}
    </section>

    {/* Authority Explorer & Capabilities Grid */}
    <section className="workbench-card p-5 shadow-md border border-[#1A1D20]/15" aria-label="Authority explorer">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#1A1D20]/10 pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1E50C8]">Authority explorer</p>
          <h2 className="mt-1 text-2xl font-bold text-[#1A1D20] heading-font">Capabilities</h2>
          <p className="mt-1 text-xs text-[#5C6068]">Conclusion first. Open Why? for dimensional explanation and technical proof.</p>
        </div>
        <select value={selectedSubject} onChange={event => setSelectedSubject(event.target.value)} className="rounded-md border border-[#1A1D20]/20 bg-white px-3 py-1.5 text-xs text-[#1A1D20] font-semibold outline-none focus:border-[#1E50C8]">
          <option value="all">All subjects</option>
          {result.subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
        </select>
      </div>

      {capabilities.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#1A1D20]/20 p-8 text-center" data-ui-state="empty">
          <h3 className="text-sm font-bold text-[#1A1D20] heading-font">Inspection completed</h3>
          <p className="mt-1 text-xs text-[#5C6068] max-w-md mx-auto">
            No supported technical evidence was found in the available inspection. This does not establish that the project has no capabilities.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">{capabilities.map(claim => <CapabilityCard key={claim.id} claim={claim} result={result} onOpen={() => setSelectedClaim(claim)} />)}</div>
      )}

      {otherClaims.length > 0 && <details className="mt-5 rounded-lg border border-[#1A1D20]/15 bg-white p-4">
        <summary className="cursor-pointer text-xs font-bold text-[#1A1D20]">Other claims and declarations <span className="ml-2 text-[#5C6068] font-mono">{otherClaims.length}</span></summary>
        <div className="mt-3 space-y-2">{otherClaims.map(claim => <button key={claim.id} onClick={() => setSelectedClaim(claim)} className="flex w-full items-center justify-between gap-3 rounded border border-[#1A1D20]/10 p-3 text-left text-xs hover:bg-[#F2EFE9] transition-colors"><span><span className="font-mono text-[#1A1D20] font-semibold">{claim.predicate}</span><span className="ml-2 text-[#5C6068]">{claim.subject}</span></span><StateBadge state={claim.status} /></button>)}</div>
      </details>}
    </section>

    {/* Unbound Runtime Observations */}
    {result.reconciliation.unboundRuntimeObservations?.length ? <section className="workbench-card p-5 shadow-md border border-[#1A1D20]/15" aria-label="Unbound runtime observations">
      <div className="flex items-center gap-2 mb-1">
        <Terminal className="h-5 w-5 text-[#B45309]" />
        <h2 className="font-bold text-[#1A1D20] text-lg heading-font">Unbound runtime observations</h2>
      </div>
      <p className="text-xs text-[#5C6068]">Runtime activity was observed, but no evidence-backed subject binding allows attribution to an agent. We cannot establish that this agent performed it.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{result.reconciliation.unboundRuntimeObservations.map(item => <EvidenceCard key={item.id} evidence={item} />)}</div>
    </section> : null}

    {/* Technical Findings */}
    {result.reconciliation.findings.length === 0 ? <details className="workbench-card p-4">
      <summary className="cursor-pointer text-xs font-semibold text-[#1A1D20]">Technical findings <span className="ml-2 font-normal text-[#5C6068]">None emitted</span></summary>
    </details> : <section className="workbench-card p-5 shadow-md border border-[#1A1D20]/15" aria-label="Technical findings">
      <h2 className="mb-4 font-bold text-[#1A1D20] text-lg heading-font">Technical findings</h2>
      <div className="space-y-3">{result.reconciliation.findings.map(finding => <article key={finding.id} className="rounded-lg border border-[#1A1D20]/15 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-[#1A1D20] text-sm">{finding.title}</h3><span className="rounded border border-[#1A1D20]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#B45309] bg-[#FFFBEB]">{finding.severity}</span></div><p className="mt-2 text-xs text-[#5C6068]">{finding.description}</p>{finding.type === 'UNDECLARED_CRITICAL_CAPABILITY' && <p className="mt-3 rounded border border-[#6D28D9]/30 bg-[#F5F3FF] p-3 text-xs text-[#6D28D9]">Critical refers to the authority involved and the fact that it is not covered by a fully reconciled declaration. This finding does not by itself indicate a security vulnerability.</p>}<details className="mt-3"><summary className="cursor-pointer text-xs text-[#1E50C8] font-semibold">Finding provenance</summary><p className="mt-2 break-all font-mono text-[10px] text-[#1E50C8] bg-[#F2EFE9] p-2 rounded border border-[#1A1D20]/10">{finding.provenance.file}{finding.provenance.location ? ` · ${finding.provenance.location}` : ''}</p></details></article>)}</div>
    </section>}

    {/* Dark Technical Proof / CLI Evidence Drawer */}
    <details className="dark-proof-drawer rounded-xl p-5 shadow-xl" data-tour-anchor="technical-proof">
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <FileCode2 className="text-[#60A5FA] h-5 w-5" />
        <span className="font-bold text-white text-lg heading-font">Evidence inspector</span>
        <span className="text-xs font-mono text-[#9CA3AF] ml-auto">{result.evidence.length} records</span>
      </summary>
      <p className="mt-3 text-xs text-[#9CA3AF]">Declared, local observed, explicitly inspected CONNECTED, and explicitly imported RUNTIME evidence remain distinguishable.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">{result.evidence.map(item => <EvidenceCard key={item.id} evidence={item} />)}</div>
      {result.evidence.length === 0 && <p className="mt-4 text-xs text-[#9CA3AF]">No evidence was emitted.</p>}
    </details>

    {/* Epistemic Non-Negotiable Semantic Rule Footer */}
    <section className="workbench-panel p-4 text-xs text-[#5C6068] leading-relaxed shadow-2xs">
      <div className="flex items-start gap-2">
        <Layers3 className="mt-0.5 inline h-4 w-4 shrink-0 text-[#1E50C8]" />
        <div>
          <span className="font-bold text-[#1A1D20]">Epistemic Model Guarantee: </span>
          Supported means compatible declaration and evidence under current Core rules. CONNECTED reports configuration at an observed time; it does not establish execution, authorization, safety, or compliance. Unknown is not failure; unverified is not false.
        </div>
      </div>
    </section>

    {/* Modal Detail view */}
    {selectedClaim && <ClaimDetail claim={selectedClaim} result={result} onClose={() => setSelectedClaim(null)} />}
  </div>;
}
