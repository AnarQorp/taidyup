import assert from 'assert';
import path from 'path';
import { getDb } from '../src/backend/db.js';
import { GitHubConnectorV2 } from '../src/backend/connectors/githubConnector.js';

interface GroundTruth {
  repoName: string;
  repoPath: string;
  expectedAgent: boolean;
  expectedFramework: string;
  expectedProvider: string;
}

async function runBenchmarkSuite() {
  console.log('📊 Starting tAIdyup External Repository Benchmark Suite...\n');

  const corpusDir = path.join(process.cwd(), 'tests/benchmark_corpus');
  const benchmarkRepos: GroundTruth[] = [
    {
      repoName: 'repo1_langgraph',
      repoPath: path.join(corpusDir, 'repo1_langgraph'),
      expectedAgent: true,
      expectedFramework: 'LangGraph',
      expectedProvider: 'OpenAI'
    },
    {
      repoName: 'repo2_crewai',
      repoPath: path.join(corpusDir, 'repo2_crewai'),
      expectedAgent: true,
      expectedFramework: 'CrewAI',
      expectedProvider: 'OpenAI'
    },
    {
      repoName: 'repo3_mcp',
      repoPath: path.join(corpusDir, 'repo3_mcp'),
      expectedAgent: true,
      expectedFramework: 'MCP Agent Protocol',
      expectedProvider: 'UNKNOWN'
    },
    {
      repoName: 'repo4_autogen',
      repoPath: path.join(corpusDir, 'repo4_autogen'),
      expectedAgent: true,
      expectedFramework: 'AutoGen',
      expectedProvider: 'UNKNOWN'
    },
    {
      repoName: 'repo5_llamaindex',
      repoPath: path.join(corpusDir, 'repo5_llamaindex'),
      expectedAgent: true,
      expectedFramework: 'LlamaIndex',
      expectedProvider: 'UNKNOWN'
    },
    {
      repoName: 'repo6_semantic_kernel',
      repoPath: path.join(corpusDir, 'repo6_semantic_kernel'),
      expectedAgent: true,
      expectedFramework: 'Semantic Kernel',
      expectedProvider: 'UNKNOWN'
    }
  ];

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let unknowns = 0;

  const orgId = `org-bench-${Date.now()}`;
  const db = await getDb();
  await db.run('INSERT INTO organizations (id, name, country, sector) VALUES (?, ?, ?, ?)', [orgId, 'Benchmark Org', 'ES', 'Testing']);

  const connId = `conn-bench-${Date.now()}`;
  await db.run(
    'INSERT INTO connectors (id, org_id, type, name, status, permissions_scope) VALUES (?, ?, "github", "Bench Conn", "active", "read-only")',
    [connId, orgId]
  );

  console.log('-----------------------------------------------------------------------------------------');
  console.log('| Repositorio Benchmark  | Agent Detected | Framework Expected / Found | Status        |');
  console.log('-----------------------------------------------------------------------------------------');

  for (const target of benchmarkRepos) {
    const res = await GitHubConnectorV2.runDiscovery(orgId, connId, target.repoPath);
    const agent = res.agents[0];

    if (target.expectedAgent && agent) {
      if (agent.framework === target.expectedFramework) {
        truePositives++;
        console.log(`| ${target.repoName.padEnd(22)} | YES            | ${target.expectedFramework.padEnd(12)} / ${agent.framework.padEnd(12)} | ✅ TP MATCH   |`);
      } else {
        falsePositives++;
        console.log(`| ${target.repoName.padEnd(22)} | YES            | ${target.expectedFramework.padEnd(12)} / ${agent.framework.padEnd(12)} | ⚠️ FP MISMATCH |`);
      }
    } else if (target.expectedAgent && !agent) {
      falseNegatives++;
      console.log(`| ${target.repoName.padEnd(22)} | NO             | ${target.expectedFramework.padEnd(12)} / UNKNOWN      | ❌ FN MISSING  |`);
    }

    if (agent && agent.provider === 'UNKNOWN') {
      unknowns++;
    }
  }

  console.log('-----------------------------------------------------------------------------------------\n');

  const totalEvaluated = benchmarkRepos.length;
  const precision = Math.round((truePositives / (truePositives + falsePositives || 1)) * 100);
  const recall = Math.round((truePositives / (truePositives + falseNegatives || 1)) * 100);

  console.log('📈 BENCHMARK RESULTS METRICS:');
  console.log(`   - Repositorios Evaluados: ${totalEvaluated}`);
  console.log(`   - True Positives (TP): ${truePositives}`);
  console.log(`   - False Positives (FP): ${falsePositives}`);
  console.log(`   - False Negatives (FN): ${falseNegatives}`);
  console.log(`   - Unknowns (UN): ${unknowns}`);
  console.log(`   - Precision: ${precision}%`);
  console.log(`   - Recall: ${recall}%\n`);

  assert.ok(truePositives >= 5, 'At least 5 out of 6 external benchmark repositories must match ground truth exactly');
}

runBenchmarkSuite().catch(err => {
  console.error('❌ Benchmark Suite Failed:', err);
  process.exit(1);
});
