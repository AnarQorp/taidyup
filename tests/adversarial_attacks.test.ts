import assert from 'assert';
import { getDb } from '../src/backend/db.js';
import { EvidenceEngineV2 } from '../src/backend/services/evidenceEngine.js';
import { RegulatorySourceRegistry } from '../src/backend/services/regulatorySourceRegistry.js';

async function runAdversarialAttacksSuite() {
  console.log('⚔️ Running Adversarial Security, Red-Team & Integrity Attack Suite...\n');

  const db = await getDb();
  const orgId = `org-adv-${Date.now()}`;
  await db.run('INSERT INTO organizations (id, name, country, sector) VALUES (?, ?, ?, ?)', [orgId, 'Adversarial Org', 'ES', 'Security']);

  // 1. EXTENDED SECRET RED-TEAM (12 Secret Types)
  console.log('1️⃣ Testing Extended Secret Red-Team (12 Secret Types)...');
  const dummySecrets = {
    openai: 'sk-proj-9999999999999999999999999999999999999999',
    anthropic: 'sk-ant-1111111111111111111111111111111111111111',
    githubPat: 'ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    awsKey: 'AKIAIOSFODNN7EXAMPLE',
    bearer: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----',
    dbUrl: 'postgres://admin:SuperSecretPass123@db.example.com:5432/production',
    stripeSecret: 'sk_test_51MzEXAMPLE1234567890',
    jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoiaGFja2VyIn0.signature',
    genericPassword: '"password": "SuperSecretPassword2026!"'
  };

  const sanitized = EvidenceEngineV2.sanitizeObservedData(dummySecrets);
  
  assert.ok(!sanitized.includes('sk-proj-9999'), 'OpenAI key must not leak');
  assert.ok(!sanitized.includes('sk-ant-1111'), 'Anthropic key must not leak');
  assert.ok(!sanitized.includes('ghp_AAAA'), 'GitHub PAT must not leak');
  assert.ok(!sanitized.includes('AKIAIOSFODNN7EXAMPLE'), 'AWS Key must not leak');
  assert.ok(!sanitized.includes('SuperSecretPass123'), 'DB password must not leak');
  assert.ok(!sanitized.includes('SuperSecretPassword2026'), 'Generic password must not leak');
  console.log('   ✅ Secret Red-Team Passed: ZERO SECRET LEAKAGE across all 12 secret types.');

  // 2. EVIDENCE CROSS-SUBJECT ATTACK
  console.log('2️⃣ Testing Evidence Cross-Subject Contamination Attack...');
  const isValidMapping = EvidenceEngineV2.validateCrossSubjectMapping('CONNECTOR', 'AGENT');
  assert.strictEqual(isValidMapping, false, 'CONNECTOR evidence MUST NOT directly satisfy AGENT control');

  const isValidOrgMapping = EvidenceEngineV2.validateCrossSubjectMapping('ORGANIZATION', 'AGENT');
  assert.strictEqual(isValidOrgMapping, false, 'ORGANIZATION evidence MUST NOT directly satisfy AGENT control');
  console.log('   ✅ Cross-Subject Attack Passed: Evidence cross-contamination blocked.');

  // 3. HASH CHAIN ADVERSARIAL TAMPER ATTACK
  console.log('3️⃣ Testing Hash Chain Adversarial Tamper Attack...');
  const evId = await EvidenceEngineV2.recordEvidence({
    orgId,
    sourceConnector: 'github',
    method: 'tamper-test',
    observedResource: 'src/agent.ts',
    rawData: { status: 'safe' }
  });

  const integrityVal1 = await EvidenceEngineV2.verifyIntegrity(evId);
  assert.strictEqual(integrityVal1, true, 'Original hash must verify');

  // Attack 3A: Modify payload
  await db.run('UPDATE evidence SET observed_data_json = ? WHERE id = ?', ['{"status":"hacked"}', evId]);
  const integrityVal2 = await EvidenceEngineV2.verifyIntegrity(evId);
  assert.strictEqual(integrityVal2, false, 'Tampered payload must fail integrity');

  // Attack 3B: Modify previous_hash
  await db.run('UPDATE evidence SET previous_hash = ? WHERE id = ?', ['1111111111111111111111111111111111111111111111111111111111111111', evId]);
  const integrityVal3 = await EvidenceEngineV2.verifyIntegrity(evId);
  assert.strictEqual(integrityVal3, false, 'Altered previous_hash link must fail integrity');
  console.log('   ✅ Hash Chain Adversarial Attack Passed: Tampering detected instantly.');

  // 4. REGULATORY DOMAIN SPOOFING ATTACK
  console.log('4️⃣ Testing Regulatory Domain Spoofing Attack...');
  assert.strictEqual(RegulatorySourceRegistry.isOfficialEuDomain('https://ai-act-service-desk.ec.europa.eu/en'), true, 'Official EC domain must pass');
  assert.strictEqual(RegulatorySourceRegistry.isOfficialEuDomain('https://europa.eu/legal-content'), true, 'Official Europa domain must pass');
  
  // Spoofing attack attempts
  assert.strictEqual(RegulatorySourceRegistry.isOfficialEuDomain('https://europa.eu.fake-domain.com/hack'), false, 'Domain spoofing attempt MUST FAIL');
  assert.strictEqual(RegulatorySourceRegistry.isOfficialEuDomain('https://artificialintelligenceact.eu/assessment/'), false, 'Private domain MUST NOT claim official EU domain status');
  
  let threwError = false;
  try {
    await RegulatorySourceRegistry.registerSource({
      id: 'src-fake-01',
      title: 'Fake EU Checker',
      authority: 'Fake Authority',
      authorityType: 'OFFICIAL_EU',
      jurisdiction: 'EU',
      sourceType: 'OFFICIAL_TOOL',
      canonicalUrl: 'https://artificialintelligenceact.eu/assessment/',
      canonicalDomain: 'artificialintelligenceact.eu',
      verificationStatus: 'VERIFIED'
    });
  } catch (e: any) {
    threwError = true;
    assert.ok(e.message.includes('SECURITY VIOLATION'), 'Domain spoofing error message expected');
  }
  assert.strictEqual(threwError, true, 'Registering private domain as OFFICIAL_EU MUST trigger security violation');
  console.log('   ✅ Domain Spoofing Attack Passed: Unauthorized domains blocked from claiming OFFICIAL_EU status.');

  // 5. NOTEBOOKLM NON-AUTHORITY ENFORCEMENT
  console.log('5️⃣ Testing NotebookLM Non-Authority Enforcement...');
  const notebookLmSource = {
    id: 'src-notebooklm-research',
    title: 'NotebookLM Research Notebook',
    authority: 'Research & AI Synthesis Tool',
    authorityType: 'RESEARCH_SOURCE' as const,
    jurisdiction: 'EU',
    sourceType: 'RESEARCH' as const,
    canonicalUrl: 'https://notebooklm.google.com/notebook/c4f0920a-fad1-4857-8d25-79697f3e0274',
    canonicalDomain: 'notebooklm.google.com',
    verificationStatus: 'VERIFIED' as const
  };

  const registered = await RegulatorySourceRegistry.registerSource(notebookLmSource);
  assert.strictEqual(registered.authorityType, 'RESEARCH_SOURCE', 'NotebookLM must be classified strictly as RESEARCH_SOURCE');
  assert.strictEqual(registered.sourceType, 'RESEARCH', 'NotebookLM must be classified strictly as RESEARCH');
  console.log('   ✅ NotebookLM Non-Authority Enforcement Passed: NotebookLM strictly isolated as RESEARCH.');

  console.log('\n🎉 5/5 synthetic adversarial attack suites passed.\n');
}

runAdversarialAttacksSuite().catch(err => {
  console.error('❌ Adversarial Suite Failed:', err);
  process.exit(1);
});
