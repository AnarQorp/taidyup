import assert from 'assert';
import path from 'path';
import { getDb } from '../src/backend/db.js';
import { EvidenceEngineV2 } from '../src/backend/services/evidenceEngine.js';
import { GitHubConnectorV2 } from '../src/backend/connectors/githubConnector.js';
import { RegulatoryApplicabilityEngine } from '../src/backend/services/applicabilityEngine.js';

async function testSecurityAndQuality() {
  console.log('🔒 Starting Security & Regulatory Quality Test Suite...\n');

  const db = await getDb();
  const orgId = `org-sec-${Date.now()}`;
  await db.run('INSERT INTO organizations (id, name, country, sector) VALUES (?, ?, ?, ?)', [orgId, 'Security Test Org', 'ES', 'Security']);

  // 1. Secrets Sanitization Test
  console.log('1️⃣ Testing Secrets Sanitization...');
  const secretPayload = {
    apiKey: 'sk-proj-SECRET1234567890ABCDEF1234567890',
    githubToken: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    normalField: 'Safe Data'
  };

  const sanitized = EvidenceEngineV2.sanitizeObservedData(secretPayload);
  assert.ok(!sanitized.includes('sk-proj-SECRET'), 'OpenAI secret key must be redacted');
  assert.ok(!sanitized.includes('ghp_ABCDEF'), 'GitHub token must be redacted');
  assert.ok(sanitized.includes('[REDACTED_SECRET]'), 'Redaction placeholder must be present');
  console.log('   ✅ Secrets Sanitization Passed: No plain secrets recorded.');

  // 2. Evidence Integrity & Tamper Detection Test
  console.log('2️⃣ Testing Evidence Integrity & Tamper Detection...');
  const evId = await EvidenceEngineV2.recordEvidence({
    orgId,
    sourceConnector: 'github',
    method: 'security-test',
    observedResource: 'config.json',
    rawData: { safe: true }
  });

  const isValBefore = await EvidenceEngineV2.verifyIntegrity(evId);
  assert.strictEqual(isValBefore, true, 'Integrity verification before tampering must be true');

  // Tamper with SQLite record directly
  await db.run('UPDATE evidence SET observed_data_json = ? WHERE id = ?', ['{"safe":false,"tampered":true}', evId]);
  const isValAfter = await EvidenceEngineV2.verifyIntegrity(evId);
  assert.strictEqual(isValAfter, false, 'Integrity verification after tampering MUST FAIL');
  console.log('   ✅ Tamper-Evident Detection Passed: Tampered record detected instantly.');

  // 3. Regulatory Integrity & Unknown Handling Test
  console.log('3️⃣ Testing Regulatory Integrity & Unknown Handling...');
  const agentId = `agent-sec-${Date.now()}`;
  await db.run(
    `INSERT INTO agents (id, org_id, name, owner_name, owner_role, purpose)
     VALUES (?, ?, 'Generic Test Agent', 'Dev', 'Tester', 'General Assistant')`,
    [agentId, orgId]
  );

  const evalRes = await RegulatoryApplicabilityEngine.evaluateReadiness(agentId);
  assert.strictEqual(evalRes.regulatoryReadiness.status, 'REVIEW_REQUIRED', 'Unconfirmed agent MUST have status REVIEW_REQUIRED');
  assert.ok(!evalRes.regulatoryReadiness.scorePercentage, 'No unbacked numerical AI Act score can be emitted when status is REVIEW_REQUIRED');
  console.log('   ✅ Regulatory Integrity Passed: Status defaults to REVIEW_REQUIRED without unbacked legal scores.');

  // 4. Collector Determinism Test
  console.log('4️⃣ Testing Collector Determinism...');
  const corpusPath = path.join(process.cwd(), 'tests/benchmark_corpus/repo1_langgraph');
  const connId = `conn-sec-${Date.now()}`;
  await db.run('INSERT INTO connectors (id, org_id, type, name, status) VALUES (?, ?, "github", "Sec Conn", "active")', [connId, orgId]);

  const run1 = await GitHubConnectorV2.runDiscovery(orgId, connId, corpusPath);
  const run2 = await GitHubConnectorV2.runDiscovery(orgId, connId, corpusPath);

  assert.strictEqual(run1.agents[0].framework, run2.agents[0].framework, 'Framework detection must be deterministic');
  assert.strictEqual(run1.agents[0].provenance.confidence, run2.agents[0].provenance.confidence, 'Confidence calculation must be deterministic');
  console.log('   ✅ Collector Determinism Passed: Identical snapshot produced identical signal.');

  console.log('\n🎉 ALL SECURITY AND QUALITY TESTS PASSED empirically!\n');
}

testSecurityAndQuality().catch(err => {
  console.error('❌ Security Tests Failed:', err);
  process.exit(1);
});
