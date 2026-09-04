import { AlertTriangle, FileCode2, Layers3, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { LocalProjectAnalysis } from '../../application/analyzeLocalProject.js';
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

function ClaimFields({ claim }: { claim: Claim }) {
  return <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-xs">
    <dt className="text-[#8d90a0]">Subject</dt><dd className="font-mono text-white">{claim.subject}</dd>
    <dt className="text-[#8d90a0]">Predicate</dt><dd className="font-mono text-white">{claim.predicate}</dd>
    {claim.action && <><dt className="text-[#8d90a0]">Action</dt><dd className="font-mono text-white">{claim.action}</dd></>}
    {claim.resource && <><dt className="text-[#8d90a0]">Resource</dt><dd className="font-mono text-white break-all">{claim.resource}</dd></>}
    {claim.constraints && Object.keys(claim.constraints).length > 0 && <><dt className="text-[#8d90a0]">Constraints</dt><dd className="font-mono text-white break-all">{JSON.stringify(claim.constraints)}</dd></>}
  </dl>;
}

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  return <article className="rounded-lg border border-white/10 bg-[#07192e] p-4 text-xs" data-source-type={evidence.sourceType}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <span className="font-mono text-primary-light">{evidence.id}</span>
      <span className="rounded border border-white/15 px-2 py-1 font-mono text-[10px] text-white">{evidence.sourceType}</span>
    </div>
    <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5">
      <dt className="text-[#8d90a0]">Type</dt><dd>{evidence.type}</dd>
      <dt className="text-[#8d90a0]">Strength</dt><dd className="font-mono">{evidence.strength}</dd>
      <dt className="text-[#8d90a0]">Collector</dt><dd>{evidence.collectorId} {evidence.collectorVersion}</dd>
      <dt className="text-[#8d90a0]">Artifact</dt><dd className="break-all font-mono">{evidence.artifact}</dd>
      <dt className="text-[#8d90a0]">File</dt><dd className="break-all font-mono">{evidence.provenance.file}</dd>
      {evidence.location && <><dt className="text-[#8d90a0]">Location</dt><dd className="font-mono">{evidence.location}</dd></>}
    </dl>
  </article>;
}

function AssessmentValue({ value }: { value: string }) {
  return <span className="inline-flex rounded border border-white/15 bg-white/5 px-2 py-1 font-mono text-[10px] text-white">{value}</span>;
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
    {coreObserved && <div className="mt-3 rounded border border-sky-400/30 bg-sky-400/10 p-3">
      <p className="text-sm font-bold text-sky-100">Core capability observed</p>
      <p className="mt-1 text-xs text-sky-100/80">Static evidence supports the core action dimension. This does not make the full declaration supported.</p>
    </div>}
    <div className="mt-4 grid gap-2">
      {dimensions.map(([label, value]) => <div key={label} className="rounded border border-white/10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-white">{label === 'Subject' ? 'Subject binding' : label}</span><AssessmentValue value={value} /></div>
        <p className="mt-2 text-xs text-[#8d90a0]">{dimensionExplanation(label, value)}</p>
      </div>)}
      <div className="rounded border border-white/10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-white">Resource relation</span><AssessmentValue value={assessment.resourceRelation} /></div>
        <p className="mt-2 text-xs text-[#8d90a0]">This relation is reported by the Core; the UI does not infer equivalence from similar labels.</p>
      </div>
      <div className="rounded border border-white/10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-white">Binding</span><AssessmentValue value={assessment.binding} /></div>
        <p className="mt-2 text-xs text-[#8d90a0]">{assessment.binding === 'UNBOUND' ? 'No evidence-backed subject binding is available for this claim.' : `Binding assessment reported by the Core: ${assessment.binding}.`}</p>
      </div>
    </div>
    {Object.keys(assessment.constraints).length > 0 && <div className="mt-4">
      <h4 className="mb-2 text-xs font-semibold text-white">Declared constraints</h4>
      <div className="space-y-2">{Object.entries(assessment.constraints).map(([name, value]) => <div key={name} className="grid gap-2 rounded border border-white/10 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
        <span className="font-mono text-xs text-white">{name}</span>
        <span className="break-all font-mono text-xs text-[#8d90a0]">{JSON.stringify(claim.constraints?.[name])}</span>
        <AssessmentValue value={value} />
      </div>)}</div>
    </div>}
    {assessment.diagnostics.length > 0 && <div className="mt-4"><h4 className="mb-2 text-xs font-semibold text-white">Core diagnostics</h4><ul className="space-y-1 text-xs text-[#8d90a0]">{assessment.diagnostics.map(item => <li key={item} className="font-mono">{item}</li>)}</ul></div>}
  </section>;
}

export function ClaimDetail({ claim, result, onClose }: { claim: Claim; result: LocalProjectAnalysis; onClose: () => void }) {
  const referencedEvidence = claim.provenance
    .map(item => item.evidenceId)
    .filter(Boolean)
    .map(id => result.evidence.find(evidence => evidence.id === id))
    .filter((evidence): evidence is Evidence => Boolean(evidence));
  const declarationEvidence = referencedEvidence.filter(item => item.sourceType === 'DECLARATION');
  const observedEvidence = referencedEvidence.filter(item => item.sourceType === 'STATIC');
  const referencedEvidenceIds = new Set([
    ...claim.provenance.map(item => item.evidenceId),
    ...(claim.assessment?.evidenceRefs || [])
  ].filter(Boolean));
  const observedRelationships = [
    ...claim.provenance,
    ...result.observedClaims.flatMap(observedClaim => observedClaim.provenance)
  ].filter((item, index, items) => item.sourceType === 'STATIC'
    && Boolean(item.snippet)
    && Boolean(item.evidenceId && referencedEvidenceIds.has(item.evidenceId))
    && items.findIndex(candidate => candidate.evidenceId === item.evidenceId && candidate.snippet === item.snippet) === index);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-label="Claim detail">
    <div className="glass-panel max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl p-6">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div><StateBadge state={claim.status} /><h2 className="mt-3 text-lg font-bold text-white">Why did this result occur?</h2></div>
        <button onClick={onClose} aria-label="Close detail" className="rounded p-2 text-[#8d90a0] hover:bg-white/5 hover:text-white"><X /></button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-white/10 bg-[#031427] p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary-light">Declared</h3>
          {claim.source === 'DECLARATION' ? <ClaimFields claim={claim} /> : <p className="text-xs text-[#8d90a0]">No declaration is represented by this result.</p>}
          <div className="mt-4 space-y-2">{declarationEvidence.map(item => <EvidenceCard key={item.id} evidence={item} />)}</div>
        </section>
        <section className="rounded-lg border border-white/10 bg-[#031427] p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-violet-200">Observed</h3>
          {observedEvidence.length ? <div className="space-y-2">{observedEvidence.map(item => <EvidenceCard key={item.id} evidence={item} />)}</div> : <p className="text-xs text-[#8d90a0]">No supporting static observation is referenced by this result.</p>}
          {observedRelationships.length > 0 && <div className="mt-3 rounded border border-white/10 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8d90a0]">Observed relationship</p>{observedRelationships.map((item, index) => <p key={`${item.artifact}-${index}`} className="mt-2 font-mono text-xs text-violet-100">{item.snippet?.replaceAll(' -> ', ' → ')}</p>)}</div>}
        </section>
      </div>
      {claim.status === 'UNDECLARED_OBSERVATION' && <section className="mt-4 rounded-lg border border-violet-400/20 bg-violet-400/5 p-4 text-xs text-violet-100">This is an observed capability that is not currently covered by a reconciled declaration.</section>}
      <ClaimAssessment claim={claim} />
      <section className="mt-4 rounded-lg border border-white/10 bg-[#031427] p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-white">Reconciled result</h3>
        <div className="flex flex-wrap items-center gap-3"><StateBadge state={claim.status} /></div>
        <div className="mt-4 space-y-2 text-xs">{claim.provenance.map((item, index) => <div key={`${item.artifact}-${index}`} className="rounded border border-white/10 p-3"><span className="font-mono text-primary-light">{item.sourceType}</span> · <span className="break-all">{item.artifact}</span>{item.location && <> · <span className="font-mono">{item.location}</span></>}{item.collectorId && <> · {item.collectorId}</>}</div>)}</div>
      </section>
    </div>
  </div>;
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

  if (state.status === 'idle') return <section className="glass-panel rounded-xl p-8 text-center" data-ui-state="idle"><Search className="mx-auto mb-3 text-primary-light" /><h2 className="font-bold text-white">Select a local project</h2><p className="mt-2 text-sm text-[#8d90a0]">Enter an existing directory containing a declared tAIdyup manifest, then run the analysis.</p></section>;
  if (state.status === 'loading') return <section className="glass-panel rounded-xl p-8 text-center" data-ui-state="loading"><div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /><h2 className="font-bold text-white">Analyzing with the Trust Kernel</h2><p className="mt-2 break-all font-mono text-xs text-[#8d90a0]">{state.targetPath}</p></section>;
  if (state.status === 'error') return <section className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-6" data-ui-state="error"><div className="flex gap-3"><AlertTriangle className="shrink-0 text-rose-300" /><div><h2 className="font-bold text-white">Analysis not completed</h2><p className="mt-1 text-sm text-rose-100">{state.message}</p>{state.details.length > 0 && <ul className="mt-3 list-disc pl-5 text-xs text-rose-100">{state.details.map(detail => <li key={detail}>{detail}</li>)}</ul>}</div></div></section>;
  if (!result) return null;

  return <div className="space-y-6" data-ui-state="success">
    <section className="glass-panel rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-[#8d90a0]">Analyzed project</p><h2 className="mt-1 text-xl font-bold text-white">{result.project.name}</h2><p className="mt-1 break-all font-mono text-xs text-[#8d90a0]">{result.project.targetPath}</p></div><div className="rounded border border-primary/30 bg-primary/10 px-3 py-2 text-xs"><span className="text-[#8d90a0]">Manifest</span><strong className="ml-2 font-mono text-primary-light">{result.manifest.status}</strong><p className="mt-1 max-w-sm break-all font-mono text-[10px] text-[#8d90a0]">{result.manifest.path}</p></div></div>
    </section>
    <section aria-label="Canonical summary"><h2 className="mb-3 text-sm font-bold text-white">Reconciliation summary</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{summaryStates.map(item => <article key={item.state} className="glass-panel rounded-lg p-4" data-epistemic-state={item.state}><StateBadge state={item.state} /><p className="mt-3 text-3xl font-bold text-white">{result.reconciliation.summary[item.key]}</p><p className="mt-1 text-xs text-[#8d90a0]">{item.label}</p></article>)}</div></section>
    <section className="glass-panel rounded-xl p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-white">Claims explorer</h2><p className="text-xs text-[#8d90a0]">Declared and observed material remain separate. Select a result to inspect its evidence.</p></div><select value={selectedSubject} onChange={event => setSelectedSubject(event.target.value)} className="rounded border border-white/15 bg-[#031427] px-3 py-2 text-xs text-white"><option value="all">All subjects</option>{result.subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}</select></div>
      {claims.length === 0 ? <div className="rounded border border-dashed border-white/15 p-8 text-center text-sm text-[#8d90a0]" data-ui-state="empty">No reconciled claims for this selection.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-[#8d90a0]"><tr><th className="px-3 py-3">Subject</th><th className="px-3 py-3">Predicate</th><th className="px-3 py-3">Action / resource</th><th className="px-3 py-3">Result</th><th className="px-3 py-3"><span className="sr-only">Detail</span></th></tr></thead><tbody className="divide-y divide-white/5">{claims.map(claim => <tr key={claim.id}><td className="px-3 py-3 font-mono text-white">{claim.subject}</td><td className="px-3 py-3 font-mono">{claim.predicate}</td><td className="px-3 py-3"><span className="font-mono text-white">{claim.action || '—'}</span><span className="ml-2 break-all text-[#8d90a0]">{claim.resource || '—'}</span></td><td className="px-3 py-3"><StateBadge state={claim.status} /></td><td className="px-3 py-3 text-right"><button onClick={() => setSelectedClaim(claim)} className="rounded border border-white/15 px-3 py-1.5 text-primary-light hover:border-primary/50">Why?</button></td></tr>)}</tbody></table></div>}
    </section>
    <section className="glass-panel rounded-xl p-5" aria-label="Technical findings"><div className="mb-4"><h2 className="font-bold text-white">Technical findings</h2><p className="text-xs text-[#8d90a0]">Findings emitted by the current reconciliation result.</p></div>{result.reconciliation.findings.length === 0 ? <p className="rounded border border-dashed border-white/15 p-6 text-center text-sm text-[#8d90a0]">No technical findings were emitted.</p> : <div className="space-y-3">{result.reconciliation.findings.map(finding => <article key={finding.id} className="rounded-lg border border-white/10 bg-[#07192e] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-white">{finding.title}</h3><span className="rounded border border-white/15 px-2 py-1 font-mono text-[10px]">{finding.severity}</span></div><p className="mt-2 text-xs text-[#8d90a0]">{finding.description}</p>{finding.type === 'UNDECLARED_CRITICAL_CAPABILITY' && <p className="mt-3 rounded border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-100">Critical refers to the authority involved and the fact that it is not covered by a fully reconciled declaration. This finding does not by itself indicate a security vulnerability.</p>}<p className="mt-3 break-all font-mono text-[10px] text-primary-light">{finding.provenance.file}{finding.provenance.location ? ` · ${finding.provenance.location}` : ''}</p></article>)}</div>}</section>
    <section className="glass-panel rounded-xl p-5"><div className="mb-4 flex items-center gap-2"><FileCode2 className="text-primary-light" /><div><h2 className="font-bold text-white">Evidence inspector</h2><p className="text-xs text-[#8d90a0]">Declaration and static evidence emitted by the current Core.</p></div></div><div className="grid gap-3 lg:grid-cols-2">{result.evidence.map(item => <EvidenceCard key={item.id} evidence={item} />)}</div>{result.evidence.length === 0 && <p className="rounded border border-dashed border-white/15 p-6 text-center text-sm text-[#8d90a0]">No evidence was emitted.</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded border border-dashed border-white/15 p-3 text-xs text-[#8d90a0]">CONNECTED — not available in Alpha</div><div className="rounded border border-dashed border-white/15 p-3 text-xs text-[#8d90a0]">RUNTIME — not available in Alpha</div></div></section>
    <section className="rounded-lg border border-white/10 bg-[#07192e] p-4 text-xs text-[#8d90a0]"><Layers3 className="mr-2 inline h-4 w-4" />Supported means a compatible declaration and static observation under current Core rules. It does not establish execution, authorization, safety, or compliance. Unknown is not failure; unverified is not false.</section>
    {selectedClaim && <ClaimDetail claim={selectedClaim} result={result} onClose={() => setSelectedClaim(null)} />}
  </div>;
}
