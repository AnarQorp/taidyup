import assert from 'assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalysisView, ClaimDetail } from '../src/frontend/components/AnalysisView.js';
import { uiTrustStatesFixture } from './fixtures/uiTrustStates.js';

function run() {
  const idle = renderToStaticMarkup(<AnalysisView state={{ status: 'idle' }} />);
  const loading = renderToStaticMarkup(<AnalysisView state={{ status: 'loading', targetPath: '/test/project' }} />);
  const error = renderToStaticMarkup(<AnalysisView state={{ status: 'error', message: 'Target missing', details: ['No directory'] }} />);
  const success = renderToStaticMarkup(<AnalysisView state={{ status: 'success', result: uiTrustStatesFixture }} />);
  const empty = renderToStaticMarkup(<AnalysisView state={{ status: 'success', result: {
    ...uiTrustStatesFixture,
    subjects: [],
    evidence: [],
    reconciliation: { ...uiTrustStatesFixture.reconciliation, reconciledClaims: [], summary: { ...uiTrustStatesFixture.reconciliation.summary, totalClaims: 0 } }
  } }} />);

  assert.match(idle, /data-ui-state="idle"/);
  assert.match(loading, /data-ui-state="loading"/);
  assert.match(error, /data-ui-state="error"/);
  assert.match(error, /Target missing/);
  assert.match(empty, /data-ui-state="empty"/);

  for (const state of ['SUPPORTED', 'UNVERIFIED', 'CONFLICT', 'UNDECLARED_OBSERVATION', 'UNKNOWN']) {
    assert.match(success, new RegExp(`data-epistemic-state="${state}"`), `${state} summary card must render`);
    assert.match(success, new RegExp(`>${state}<`), `${state} result must render`);
  }
  assert.strictEqual((success.match(/>1<\/p>/g) || []).length >= 5, true, 'summary counts must come from the fixture reconciliation summary');
  assert.match(success, /Declared and observed material remain separate/);
  assert.match(success, /data-source-type="DECLARATION"/);
  assert.match(success, /data-source-type="STATIC"/);
  assert.match(success, /CONNECTED — not available in Alpha/);
  assert.match(success, /RUNTIME — not available in Alpha/);
  assert.match(success, /Technical findings/);
  assert.match(success, /TEST ONLY declaration conflict/);

  const detailClaim = uiTrustStatesFixture.reconciliation.reconciledClaims[1];
  const detail = renderToStaticMarkup(<ClaimDetail claim={detailClaim} result={uiTrustStatesFixture} onClose={() => {}} />);
  assert.match(detail, />Declared</);
  assert.match(detail, />Observed</);
  assert.match(detail, /test-manifest-parser/);
  assert.match(detail, /test-only-collector/);
  assert.match(detail, /AGENT_BOUND/);
  assert.match(detail, /Core capability observed/);
  assert.match(detail, /Subject binding/);
  assert.match(detail, /UNBOUND/);
  assert.match(detail, /Resource relation/);
  assert.match(detail, /UNRESOLVED/);
  assert.match(detail, /approval_required/);
  assert.match(detail, /UNVERIFIED/);
  assert.match(detail, /agent output → execution sink/);
  assert.doesNotMatch(detail, /Confidence: 60%/);
  assert.match(detail, /Static evidence supports the core action dimension/);

  const contradicted = renderToStaticMarkup(<ClaimDetail claim={{
    ...detailClaim,
    status: 'CONFLICT',
    assessment: { ...detailClaim.assessment!, overall: 'CONFLICT', constraints: { approval_required: 'CONTRADICTED' } }
  }} result={uiTrustStatesFixture} onClose={() => {}} />);
  assert.match(contradicted, /CONTRADICTED/);
  assert.doesNotMatch(contradicted, />AUTHORIZED<|>VERIFIED</);

  const criticalContext = renderToStaticMarkup(<AnalysisView state={{ status: 'success', result: {
    ...uiTrustStatesFixture,
    reconciliation: {
      ...uiTrustStatesFixture.reconciliation,
      findings: [{
        id: 'critical-execute', type: 'UNDECLARED_CRITICAL_CAPABILITY', severity: 'CRITICAL',
        title: 'Undeclared Critical Capability: EXECUTE', description: 'Observed authority.', evidenceRefs: [], provenance: { file: '/test/agent.ts' }
      }]
    }
  } }} />);
  assert.match(criticalContext, /Critical refers to the authority involved/);
  assert.match(criticalContext, /does not by itself indicate a security vulnerability/);

  const undeclared = renderToStaticMarkup(<ClaimDetail claim={uiTrustStatesFixture.reconciliation.reconciledClaims[3]} result={uiTrustStatesFixture} onClose={() => {}} />);
  assert.match(undeclared, /observed capability that is not currently covered by a reconciled declaration/i);

  for (const obsolete of ['Acme Automation', '82%', 'Technical Trust Readiness', 'Regulatory Readiness', 'Legal Status', 'Verified Dimensions', 'Minimum Permissions Guaranteed', 'Authorized Scope', 'Agent Passport V2']) {
    assert.ok(!success.includes(obsolete), `product UI must not render obsolete claim: ${obsolete}`);
  }
}

try {
  run();
  console.log('✅ UI vertical tests passed');
} catch (error) {
  console.error(error);
  process.exit(1);
}
