import assert from 'assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalysisView, ClaimDetail } from '../src/frontend/components/AnalysisView.js';
import type { LocalProjectAnalysis } from '../src/application/analyzeLocalProject.js';

const runtimeEvidence: any = {
  id: 'runtime-1', type: 'RUNTIME_EXECUTION_COMPLETED', sourceType: 'RUNTIME', subject: 'agent:mailer',
  observedAt: '2026-09-06T10:02:00.000Z', collectorId: 'runtime-test', collectorVersion: '0.1',
  artifact: 'runtime.jsonl', location: 'line:3', strength: 'RUNTIME_CONFIRMED', sha256: 'hash',
  provenance: { file: 'runtime.jsonl', lineRange: '3' },
  data: { eventKind: 'EXECUTION_COMPLETED', outcome: 'SUCCEEDED', bindings: { subject: { state: 'BOUND' }, action: { state: 'BOUND' }, resource: { state: 'BOUND' }, constraints: { state: 'UNBOUND' } } }
};
const claim: any = { id: 'send', subject: 'agent:mailer', predicate: 'CAN', action: 'SEND', resource: 'mail-class', source: 'DECLARATION', status: 'SUPPORTED', provenance: [{ sourceType: 'RUNTIME', artifact: 'runtime.jsonl', evidenceId: 'runtime-1' }], runtimeAssessment: { observationState: 'COMPLETION_OBSERVED', latestEvent: 'EXECUTION_COMPLETED', latestOutcome: 'SUCCEEDED', observedCount: 1, observedExecutionInstances: 1, observedEvents: 3, completeness: 'PARTIAL_OBSERVATION', binding: 'BOUND', evidenceRefs: ['runtime-1'], diagnostics: ['RUNTIME_PARTIAL_OBSERVATION'], lastObservedAt: '2026-09-06T10:02:00.000Z' } };
const result: LocalProjectAnalysis = { project: { name: 'Runtime fixture', targetPath: '/test/project' }, manifest: { path: 'taidyup.json', status: 'DECLARED' }, subjects: ['agent:mailer'], declaredClaims: [claim], observedClaims: [], evidence: [runtimeEvidence], reconciliation: { schemaVersion: '1.2.0', timestamp: '2026-09-06T10:03:00.000Z', summary: { totalClaims: 1, supportedCount: 1, unverifiedCount: 0, conflictCount: 0, undeclaredCount: 0, unknownCount: 0, criticalFindingsCount: 0 }, reconciledClaims: [claim], findings: [], unboundRuntimeObservations: [] } };

const html = renderToStaticMarkup(<AnalysisView state={{ status: 'success', result }} />);
const detail = renderToStaticMarkup(<ClaimDetail claim={claim} result={result} onClose={() => {}} />);
assert.match(html, /Completion observed/); assert.match(html, /Source reported success/); assert.doesNotMatch(html, /executed exactly|authorized execution/i);
assert.match(detail, /1 distinct execution instance observed/); assert.match(detail, /3 runtime events/); assert.match(detail, /PARTIAL_OBSERVATION/); assert.match(detail, /Whether the action was authorized/); assert.match(detail, /Whether all executions were observed/); assert.match(detail, /data-source-type="RUNTIME"/);
console.log('GUI RUNTIME V0 semantics PASS');
