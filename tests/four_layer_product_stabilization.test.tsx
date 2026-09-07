import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalysisView, ClaimDetail } from '../src/frontend/components/AnalysisView.js';
import { runtimeDataToEvidence } from '../src/runtime/runtimeEvidence.js';
import { DiffEngine } from '../src/cli/diffEngine.js';
import { ReconciliationEngine } from '../src/trust-kernel/reconciliationEngine.js';
import { ReportGenerator } from '../src/trust-kernel/reportGenerator.js';
import type { LocalProjectAnalysis } from '../src/application/analyzeLocalProject.js';
import type { Claim, Evidence, ReconciledTrustState, RuntimeEventKind, RuntimeOutcome } from '../src/trust-kernel/types.js';

const subject = 'agent:mailer';
const resource = 'mail-service';
const declarationEvidence: Evidence = {
  id: 'decl-evidence', type: 'DECLARATION_MANIFEST', sourceType: 'DECLARATION', subject,
  observedAt: '2026-09-06T09:00:00.000Z', collectorId: 'manifest', collectorVersion: '1',
  artifact: 'taidyup.json', data: {}, strength: 'DEPENDENCY_ONLY', sha256: 'decl', provenance: { file: 'taidyup.json' }
};
function declaration(predicate: 'CAN' | 'CANNOT' = 'CAN', action: 'SEND' | 'WRITE' = 'SEND', target = resource): Claim {
  return { id: `decl-${predicate}-${action}`, subject, predicate, action, resource: target, source: 'DECLARATION', status: 'DECLARED', provenance: [{ sourceType: 'DECLARATION', artifact: 'taidyup.json', evidenceId: 'decl-evidence' }] };
}
function evidence(sourceType: 'STATIC' | 'CONNECTED', observation: 'PRESENCE' | 'ABSENCE_OBSERVED' = 'PRESENCE', at = '2026-09-06T10:00:00.000Z'): Evidence {
  return {
    id: `${sourceType}-${observation}-${at}`, type: `${sourceType}_CAPABILITY`, sourceType, subject, observedAt: at,
    collectorId: `${sourceType.toLowerCase()}-fixture`, collectorVersion: '1', artifact: `${sourceType.toLowerCase()}.json`,
    data: { capability: 'SEND', resource, capabilityPathBound: true, observation, ...(sourceType === 'CONNECTED' ? { connectedSnapshot: { mode: 'POINT_IN_TIME', sourceInstance: 'local-n8n', scope: 'workflow-1', completeness: 'COMPLETE', retrievalStatus: 'SUCCESS', revision: at, observedAt: at } } : {}) },
    strength: 'AGENT_BOUND', sha256: `${sourceType}-${at}`, provenance: { file: `${sourceType.toLowerCase()}.json` }
  };
}
function runtime(kind: RuntimeEventKind, run: string, at: string, outcome?: RuntimeOutcome, bound = true): Evidence {
  return runtimeDataToEvidence({
    schemaVersion: '0.1', eventKind: kind, eventTime: at, operation: { action: 'SEND', resource },
    bindings: {
      subject: bound ? { state: 'BOUND', method: 'STRUCTURAL', value: subject, evidence: 'analysis binding', evidenceRef: 'evidence:subject-binding' } : { state: 'UNBOUND' },
      action: { state: 'BOUND', method: 'STRUCTURAL', value: 'SEND', evidence: 'dispatch', evidenceRef: 'evidence:dispatch' },
      resource: { state: 'BOUND', method: 'STRUCTURAL', value: resource, evidence: 'resource class', evidenceRef: 'evidence:resource' }, constraints: { state: 'UNBOUND' }
    },
    source: { kind: 'IMPORTED_ARTIFACT', identity: 'product.fixture' }, sourceEventId: `${run}:${kind}`,
    observationScope: { kind: 'RUN', id: run }, completeness: 'PARTIAL_OBSERVATION',
    sanitization: { policy: 'ALLOWLIST_V0', rawPayloadPersisted: false, droppedFields: ['arguments', 'result', 'exception'] }, outcome, runId: run
  }, 'runtime.jsonl', 1);
}
function analyze(claims: Claim[], evidences: Evidence[]): LocalProjectAnalysis {
  const reconciliation = ReconciliationEngine.reconcile(claims, evidences);
  return {
    project: { name: 'Four-layer product fixture', targetPath: '/test/four-layer' }, manifest: { status: 'DECLARED', path: 'taidyup.json' },
    scan: { scannerVersion: 'test', scannedPath: '/test/four-layer', timestamp: '2026-09-06T12:00:00.000Z', assets: [], summary: { totalAssets: 0, agentCount: 0, workflowCount: 0, toolCount: 0, unknownCount: 0 } },
    subjects: Array.from(new Set(reconciliation.reconciledClaims.map(item => item.subject))), declaredClaims: claims,
    observedClaims: [], evidence: [...(claims.length ? [declarationEvidence] : []), ...evidences], reconciliation
  };
}
function surfaces(result: LocalProjectAnalysis): { html: string; detail: string; passport: string; json: string } {
  const claim = result.reconciliation.reconciledClaims[0];
  return {
    html: renderToStaticMarkup(<AnalysisView state={{ status: 'success', result }} />),
    detail: claim ? renderToStaticMarkup(<ClaimDetail claim={claim} result={result} onClose={() => {}} />) : '',
    passport: ReportGenerator.generateMarkdownReport(result.project.name, result.reconciliation),
    json: JSON.stringify(result.reconciliation)
  };
}

// A — all four layers compose while authority and runtime remain separate.
const a = analyze([declaration()], [evidence('STATIC'), evidence('CONNECTED'), runtime('EXECUTION_STARTED', 'a', '2026-09-06T10:01:00.000Z'), runtime('EXECUTION_COMPLETED', 'a', '2026-09-06T10:02:00.000Z', 'SUCCEEDED')]);
assert.equal(a.reconciliation.reconciledClaims[0].status, 'SUPPORTED');
const aSurface = surfaces(a);
for (const text of ['Declared', 'Observed', 'Connected', 'Runtime', 'Completion observed', 'Source reported success', 'PARTIAL_OBSERVATION', 'Whether the action was authorized', 'RUNTIME_SOURCE_EVIDENCE']) assert.match(`${aSurface.html}${aSurface.detail}${aSurface.passport}`, new RegExp(text));
assert.doesNotMatch(aSurface.detail, /RUNTIME_CONFIRMED/);
assert.doesNotMatch(`${aSurface.html}${aSurface.detail}${aSurface.passport}`, /execution verified|authorized execution|result is correct/i);
assert.doesNotMatch(aSurface.detail, /Whether execution activity occurred/);
assert.doesNotMatch(aSurface.passport, /Confidence:|\d+%/);
assert.match(aSurface.json, /"latestOutcome":"SUCCEEDED"/);

// B — supported authority with no runtime evidence never becomes an absence claim.
const b = analyze([declaration()], [evidence('STATIC'), evidence('CONNECTED')]);
assert.equal(b.reconciliation.reconciledClaims[0].runtimeAssessment?.observationState, 'NO_OBSERVATION');
const bSurface = surfaces(b); assert.match(bSurface.html, /No runtime evidence available/); assert.doesNotMatch(`${bSurface.html}${bSurface.detail}${bSurface.passport}`, /never executed|not executed/i);
assert.match(bSurface.passport, /no runtime evidence is not evidence of no execution/i);

// C — current-state drift and historical runtime are both visible and temporally distinct.
const c = analyze([declaration()], [evidence('STATIC'), evidence('CONNECTED', 'PRESENCE', '2026-09-06T10:00:00.000Z'), runtime('EXECUTION_COMPLETED', 'c', '2026-09-06T10:30:00.000Z', 'SUCCEEDED'), evidence('CONNECTED', 'ABSENCE_OBSERVED', '2026-09-06T11:00:00.000Z')]);
assert.equal(c.reconciliation.reconciledClaims[0].status, 'UNVERIFIED');
const cSurface = surfaces(c); assert.match(cSurface.detail, /Current comparable CONNECTED evidence no longer supports/); assert.match(cSurface.detail, /historical runtime evidence remains historical/); assert.match(cSurface.detail, /Completion observed/);

// D — undeclared occurrence is not described as unauthorized or malicious.
const d = analyze([], [runtime('EXECUTION_COMPLETED', 'd', '2026-09-06T10:00:00.000Z', 'SUCCEEDED')]);
assert.equal(d.reconciliation.reconciledClaims[0].status, 'UNDECLARED_OBSERVATION');
assert.doesNotMatch(`${surfaces(d).detail}${surfaces(d).passport}`, /unauthori[sz]ed|malicious|illegal|non-compliant/i);

// E — actual occurrence conflicts with CANNOT; attempt-only does not.
const attempted = analyze([declaration('CANNOT')], [runtime('INVOCATION_ATTEMPTED', 'e1', '2026-09-06T10:00:00.000Z')]);
assert.notEqual(attempted.reconciliation.reconciledClaims[0].status, 'CONFLICT');
const e = analyze([declaration('CANNOT')], [runtime('EXECUTION_STARTED', 'e2', '2026-09-06T10:00:00.000Z'), runtime('EXECUTION_COMPLETED', 'e2', '2026-09-06T10:01:00.000Z', 'UNKNOWN')]);
assert.equal(e.reconciliation.reconciledClaims[0].status, 'CONFLICT'); assert.match(surfaces(e).detail, /conflicts with the explicit declaration/i); assert.doesNotMatch(surfaces(e).detail, /policy violation|unauthorized execution|illegal action/i);

// F — useful runtime activity remains visible without false agent attribution.
const f = analyze([], [runtime('EXECUTION_COMPLETED', 'f', '2026-09-06T10:00:00.000Z', 'UNKNOWN', false)]);
assert.equal(f.reconciliation.reconciledClaims.length, 0); assert.equal(f.reconciliation.unboundRuntimeObservations?.length, 1);
const fHtml = surfaces(f).html; assert.match(fHtml, /Unbound runtime observations/); assert.match(fHtml, /no evidence-backed subject binding allows attribution to an agent/);

// G — a negative declaration without evidence remains an explained evidence gap.
const g = analyze([declaration('CANNOT', 'WRITE', 'crm')], []);
assert.equal(g.reconciliation.reconciledClaims[0].status, 'UNVERIFIED');
const gSurface = surfaces(g); assert.match(gSurface.detail, /insufficient to support the full capability claim/); assert.match(gSurface.detail, /currently configured in a connected source/);

// H — release comparison names capability evidence change without claiming authorization.
const historicalClaim = (action: 'READ' | 'WRITE'): Claim => ({ ...a.reconciliation.reconciledClaims[0], id: `historical-${action}`, action, resource: action === 'READ' ? 'mailbox' : 'drafts' });
const base: ReconciledTrustState = { ...b.reconciliation, timestamp: '2026-09-01T00:00:00.000Z', reconciledClaims: [historicalClaim('READ'), historicalClaim('WRITE')] };
const target: ReconciledTrustState = { ...a.reconciliation, timestamp: '2026-09-06T00:00:00.000Z', reconciledClaims: [...base.reconciledClaims, a.reconciliation.reconciledClaims[0]] };
const diff = DiffEngine.computeDiff(base, target);
assert.equal(diff.addedCapabilities.some(item => item.includes(':SEND:')), true); assert.match(diff.summaryText, /CRITICAL CAPABILITY EVIDENCE ADDED/); assert.doesNotMatch(diff.summaryText, /authority expansion/i);

console.log('Four-layer product stabilization: scenarios A-H and cross-surface semantics PASS');
