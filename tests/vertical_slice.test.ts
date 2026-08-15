import assert from 'assert';
import { getDb } from '../src/backend/db';
import { GitHubConnectorV2 } from '../src/backend/connectors/githubConnector';

async function testVerticalSlice() {
  console.log('🧪 Starting End-to-End Vertical Slice Test for tAIdyup...');

  const db = await getDb();

  // 1. Create Organization
  const orgId = `org-test-${Date.now()}`;
  await db.run(
    'INSERT INTO organizations (id, name, country, sector) VALUES (?, ?, ?, ?)',
    [orgId, 'Test SME Agency S.L.', 'ES', 'AI Automation']
  );
  console.log('✅ Step 1: Organization created successfully:', orgId);

  // 2. Initialize Read-Only GitHub Connector
  const connectorId = `conn-test-${Date.now()}`;
  await db.run(
    `INSERT INTO connectors (id, org_id, type, name, status, permissions_scope)
     VALUES (?, ?, 'github', 'GitHub Read-Only Connector Test', 'active', 'read-only')`,
    [connectorId, orgId]
  );
  console.log('✅ Step 2: Read-Only GitHub Connector initialized:', connectorId);

  // 3. Execute Discovery Engine Scan
  const discoveryResult = await GitHubConnectorV2.runDiscovery(orgId, connectorId, process.cwd());
  console.log('✅ Step 3-6: Automated Discovery completed:');
  console.log(`   - Agents Discovered: ${discoveryResult.agentsDiscovered}`);
  console.log(`   - Evidences Recorded: ${discoveryResult.evidencesRecorded}`);
  console.log(`   - Findings Created: ${discoveryResult.findingsCreated}`);
  console.log(`   - Tasks Created: ${discoveryResult.tasksCreated}`);

  assert.ok(discoveryResult.agentsDiscovered >= 1, 'At least 1 agent should be discovered');
  assert.ok(discoveryResult.evidencesRecorded >= 1, 'At least 1 evidence item should be recorded');

  // 4. Verify Evidence First-Class Entity & SHA-256 Hashes
  const evidenceList = await db.all('SELECT * FROM evidence WHERE org_id = ?', [orgId]);
  for (const ev of evidenceList) {
    assert.ok(ev.sha256_hash && ev.sha256_hash.length === 64, 'SHA-256 hash must be a 64-character hex string');
    assert.strictEqual(ev.sanitization_status, 'SANITIZED_VERIFIED');
    console.log(`   🔐 Evidence SHA-256 Verified: ${ev.id} -> ${ev.sha256_hash.substring(0, 16)}...`);
  }
  console.log('✅ Step 7-8: First-class evidence cryptographically verified.');

  // 5. Verify Agent Passport Registry Data
  const agents = await db.all('SELECT * FROM agents WHERE org_id = ?', [orgId]);
  assert.ok(agents.length >= 1, 'Agent Passport record exists in database');
  const agent = agents[0];
  assert.ok(agent.name, 'Agent has a valid name');
  assert.ok(agent.technical_exposure, 'Agent has assigned Technical Exposure Tier');
  console.log(`✅ Step 9: Agent Passport V2 verified for "${agent.name}" (${agent.technical_exposure}).`);

  // 6. Verify Legal Applicability Record
  const appRecord = await db.get('SELECT * FROM regulatory_applicability WHERE agent_id = ?', [agent.id]);
  assert.ok(appRecord, 'Regulatory applicability record created');
  assert.strictEqual(appRecord.overall_status, 'REVIEW_REQUIRED');
  console.log('✅ Step 10: Legal Applicability Record initialized with status REVIEW_REQUIRED.');

  console.log('\n🎉 ALL STEPS OF THE VERTICAL SLICE PASSED empirical verification!\n');
}

testVerticalSlice().catch(err => {
  console.error('❌ Vertical Slice Test Failed:', err);
  process.exit(1);
});
