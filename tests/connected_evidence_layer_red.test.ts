import assert from 'node:assert/strict';
import { ReconciliationEngine } from '../src/trust-kernel/reconciliationEngine.js';
import { Claim, Evidence, EvidenceStrength } from '../src/trust-kernel/types.js';

const subject = 'agent:alpha';
const resource = 'email:outbound';
const claim = (overrides: Partial<Claim> = {}): Claim => ({ id: 'declared-send', subject, predicate: 'CAN', action: 'SEND', resource, source: 'DECLARATION', status: 'DECLARED', provenance: [{ sourceType: 'DECLARATION', artifact: 'taidyup.json' }], ...overrides });
const staticEvidence = (overrides: Partial<Evidence> = {}): Evidence => ({ id: 'static-send', type: 'STATIC_CAPABILITY_OBSERVATION', sourceType: 'STATIC', subject, observedAt: '2026-01-01T00:00:00.000Z', collectorId: 'scanner', collectorVersion: '1', artifact: 'artifact.json', data: { capability: 'SEND', resource, capabilityPathBound: true, configurationIdentity: { sourceInstance: 'instance-a', scope: 'workflow-1' } }, strength: 'AGENT_BOUND', sha256: 'static', provenance: { file: 'artifact.json' }, ...overrides });
const connected = (id: string, at: string, observation: 'PRESENCE' | 'ABSENCE_OBSERVED', overrides: any = {}): Evidence => {
  const { data, ...evidenceOverrides } = overrides;
  return { id, type: 'CONNECTED_CAPABILITY_SNAPSHOT', sourceType: 'CONNECTED', subject, observedAt: at, collectorId: 'connected-test', collectorVersion: '1', artifact: 'connected://instance-a/workflow-1', data: { capability: 'SEND', resource, capabilityPathBound: true, observation, connectedSnapshot: { mode: 'POINT_IN_TIME', sourceInstance: 'instance-a', scope: 'workflow-1', completeness: 'COMPLETE', retrievalStatus: 'SUCCESS', revision: id }, ...data }, strength: 'AGENT_BOUND' as EvidenceStrength, sha256: id, provenance: { file: 'connected://instance-a/workflow-1' }, ...evidenceOverrides };
};
const reconcile = (evidence: Evidence[], declared = claim()) => ReconciliationEngine.reconcile([declared], evidence);

// A: positive STATIC + positive CONNECTED support with both provenance refs.
{
  const state = reconcile([staticEvidence(), connected('c-positive', '2026-01-02T00:00:00Z', 'PRESENCE')]);
  assert.equal(state.reconciledClaims[0].status, 'SUPPORTED');
  assert.deepEqual(new Set(state.reconciledClaims[0].assessment?.evidenceRefs), new Set(['static-send', 'c-positive']));
  assert.equal(state.reconciledClaims[0].provenance.some(p => p.sourceType === 'CONNECTED'), true);
}
// B: later complete absence blocks naive support and reports drift.
{
  const state = reconcile([staticEvidence(), connected('c-absent', '2026-01-03T00:00:00Z', 'ABSENCE_OBSERVED')]);
  assert.equal(state.reconciledClaims[0].status, 'UNVERIFIED');
  assert.ok(state.reconciledClaims[0].assessment?.diagnostics.includes('CURRENT_STATE_DRIFT'));
}
// C/D: partial silence and failed retrieval cannot establish absence.
for (const [id, meta] of [['partial', { completeness: 'PARTIAL', retrievalStatus: 'SUCCESS' }], ['denied', { completeness: 'COMPLETE', retrievalStatus: 'ACCESS_DENIED' }]] as const) {
  const absence = connected(id, '2026-01-03T00:00:00Z', 'ABSENCE_OBSERVED'); Object.assign(absence.data.connectedSnapshot, meta);
  assert.equal(reconcile([staticEvidence(), absence]).reconciledClaims[0].status, 'SUPPORTED');
}
// E/F: latest comparable CONNECTED observation governs current state; history remains.
{
  const older = connected('older-positive', '2026-01-02T00:00:00Z', 'PRESENCE');
  const newer = connected('newer-absence', '2026-01-03T00:00:00Z', 'ABSENCE_OBSERVED');
  const state = reconcile([older, newer]);
  assert.equal(state.reconciledClaims[0].status, 'UNVERIFIED');
  assert.ok(state.reconciledClaims[0].assessment?.evidenceRefs.includes('older-positive'));
  assert.equal(reconcile([newer, { ...older, id: 'newer-positive', observedAt: '2026-01-04T00:00:00Z', sha256: 'newer-positive' }]).reconciledClaims[0].status, 'SUPPORTED');
}
// G/H: different instance or workflow scope cannot supersede.
for (const data of [{ sourceInstance: 'instance-b' }, { scope: 'workflow-copy' }]) {
  const absence = connected('other', '2026-01-03T00:00:00Z', 'ABSENCE_OBSERVED'); Object.assign(absence.data.connectedSnapshot, data);
  assert.equal(reconcile([staticEvidence(), absence]).reconciledClaims[0].status, 'SUPPORTED');
}
// I: dynamic connected resource cannot confirm or negate exact resource.
{
  const dynamic = connected('dynamic', '2026-01-03T00:00:00Z', 'PRESENCE', { data: { resource: 'dynamic:recipient' } });
  assert.equal(reconcile([dynamic]).reconciledClaims[0].status, 'UNVERIFIED');
}
// J: new CONNECTED agent-bound capability becomes undeclared, never authorized.
{
  const state = ReconciliationEngine.reconcile([], [connected('undeclared', '2026-01-02T00:00:00Z', 'PRESENCE')]);
  assert.equal(state.reconciledClaims[0].status, 'UNDECLARED_OBSERVATION');
  assert.equal(state.reconciledClaims[0].source, 'CONNECTED');
}
// K: explicitly disabled current capability is absence, not current availability.
{
  const disabled = connected('disabled', '2026-01-03T00:00:00Z', 'ABSENCE_OBSERVED', { data: { absenceReason: 'DISABLED' } });
  assert.equal(reconcile([staticEvidence(), disabled]).reconciledClaims[0].status, 'UNVERIFIED');
}
// L/M: credential existence and configured gate do not satisfy stronger constraints.
for (const constraints of [{ credential_valid: true }, { approval_required: true }]) {
  const evidence = connected('context-only', '2026-01-02T00:00:00Z', 'PRESENCE', { data: { constraintEvidence: { credential_valid: { value: true, sameCapabilityPath: false }, approval_required: { value: true, sameCapabilityPath: false } } } });
  assert.equal(reconcile([evidence], claim({ constraints })).reconciledClaims[0].status, 'UNVERIFIED');
}
// N: incomparable scopes do not latest-wins collapse.
{
  const positive = connected('scope-a', '2026-01-02T00:00:00Z', 'PRESENCE');
  const absence = connected('scope-b', '2026-01-03T00:00:00Z', 'ABSENCE_OBSERVED'); absence.data.connectedSnapshot.scope = 'other-scope';
  assert.equal(reconcile([positive, absence]).reconciledClaims[0].status, 'SUPPORTED');
}
// O: malformed timestamp/missing source identity can prove positive only, never precedence.
{
  const malformed = connected('malformed', 'not-a-date', 'ABSENCE_OBSERVED'); delete malformed.data.connectedSnapshot.sourceInstance;
  assert.equal(reconcile([staticEvidence(), malformed]).reconciledClaims[0].status, 'SUPPORTED');
}
// P/Q: partial absence forbidden; complete empty scoped absence accepted.
{
  const partial = connected('partial-empty', '2026-01-03T00:00:00Z', 'ABSENCE_OBSERVED'); partial.data.connectedSnapshot.completeness = 'PARTIAL';
  assert.equal(reconcile([staticEvidence(), partial]).reconciledClaims[0].status, 'SUPPORTED');
  assert.equal(reconcile([staticEvidence(), connected('complete-empty', '2026-01-03T00:00:00Z', 'ABSENCE_OBSERVED')]).reconciledClaims[0].status, 'UNVERIFIED');
}
// R: same revision fetched twice does not create drift.
{
  const one = connected('same-1', '2026-01-02T00:00:00Z', 'PRESENCE');
  const two = connected('same-2', '2026-01-03T00:00:00Z', 'PRESENCE'); two.data.connectedSnapshot.revision = one.data.connectedSnapshot.revision;
  const state = reconcile([one, two]);
  assert.equal(state.reconciledClaims[0].status, 'SUPPORTED');
  assert.equal(state.reconciledClaims[0].assessment?.diagnostics.includes('CURRENT_STATE_DRIFT'), false);
}
// S: weak CONNECTED stays weak for critical capability.
{
  const weak = connected('weak', '2026-01-02T00:00:00Z', 'PRESENCE', { strength: 'DEPENDENCY_ONLY' });
  assert.equal(reconcile([weak]).reconciledClaims[0].status, 'UNVERIFIED');
}
// T: old CONNECTED absence cannot erase a later STATIC observation.
{
  const oldAbsence = connected('old-absence', '2025-01-01T00:00:00Z', 'ABSENCE_OBSERVED');
  const currentStatic = staticEvidence({ observedAt: '2026-01-01T00:00:00Z' });
  assert.equal(reconcile([oldAbsence, currentStatic]).reconciledClaims[0].status, 'SUPPORTED');
}

console.log('CONNECTED evidence layer RED matrix: 20/20 PASS');
