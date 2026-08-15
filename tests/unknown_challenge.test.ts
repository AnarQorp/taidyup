import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '../src/backend/db.js';
import { GitHubConnectorV2 } from '../src/backend/connectors/githubConnector.js';

async function runUnknownChallenge() {
  console.log('🏆 RUNNING UNKNOWN REPOSITORY CHALLENGE (FROZEN COLLECTOR RULES)...');
  
  // Freeze Collector Hash Verification
  const collectorFile = path.join(process.cwd(), 'src/backend/connectors/githubConnector.ts');
  const collectorContent = fs.readFileSync(collectorFile, 'utf-8');
  const frozenHash = crypto.createHash('sha256').update(collectorContent).digest('hex');
  console.log(`   🔒 Frozen Collector SHA-256 Hash: ${frozenHash.substring(0, 16)}...\n`);

  const baseDir = path.join(process.cwd(), 'benchmarks/unknown_challenge');
  const db = await getDb();
  const orgId = `org-challenge-${Date.now()}`;
  await db.run('INSERT INTO organizations (id, name, country, sector) VALUES (?, ?, ?, ?)', [orgId, 'Challenge Org', 'ES', 'Challenge']);

  const connId = `conn-challenge-${Date.now()}`;
  await db.run(
    'INSERT INTO connectors (id, org_id, type, name, status, permissions_scope) VALUES (?, ?, "github", "Challenge Conn", "active", "read-only")',
    [connId, orgId]
  );

  const repos = [
    { id: 'challenge_repo_1_langchain_tavily', expectedFramework: 'LangChain', expectedProvider: 'OpenAI' },
    { id: 'challenge_repo_2_crewai_ollama', expectedFramework: 'CrewAI', expectedProvider: 'UNKNOWN' },
    { id: 'challenge_repo_3_semantic_kernel_azure', expectedFramework: 'Semantic Kernel', expectedProvider: 'UNKNOWN' }
  ];

  let matches = 0;

  console.log('---------------------------------------------------------------------------------------------------');
  console.log('| Challenge Repo ID                         | Detected Framework | Expected Framework | Result     |');
  console.log('---------------------------------------------------------------------------------------------------');

  for (const repo of repos) {
    const repoPath = path.join(baseDir, repo.id);
    const res = await GitHubConnectorV2.runDiscovery(orgId, connId, repoPath);
    const agent = res.agents[0];

    if (agent && agent.framework === repo.expectedFramework) {
      matches++;
      console.log(`| ${repo.id.padEnd(41)} | ${agent.framework.padEnd(18)} | ${repo.expectedFramework.padEnd(18)} | ✅ PASSED  |`);
    } else {
      console.log(`| ${repo.id.padEnd(41)} | ${(agent?.framework || 'NONE').padEnd(18)} | ${repo.expectedFramework.padEnd(18)} | ❌ FAILED  |`);
    }
  }

  console.log('---------------------------------------------------------------------------------------------------\n');

  const accuracy = Math.round((matches / repos.length) * 100);
  console.log(`🏆 UNKNOWN REPOSITORY CHALLENGE RESULTS: ${matches}/${repos.length} repos matched (${accuracy}% Accuracy)\n`);

  assert.strictEqual(matches, 3, 'All 3 unknown challenge repositories must match ground truth on frozen rules');
}

runUnknownChallenge().catch(err => {
  console.error('❌ Unknown Challenge Failed:', err);
  process.exit(1);
});
