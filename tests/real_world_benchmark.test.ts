import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { getDb } from '../src/backend/db.js';
import { GitHubConnectorV2 } from '../src/backend/connectors/githubConnector.js';

interface GroundTruthItem {
  repoId: string;
  isAgent: boolean;
  framework: string;
  provider: string;
  toolsCount: number;
  hasShell: boolean;
}

async function runRealWorldBenchmark() {
  console.log('🔥 Running 25 Real-World & Negative Control Benchmark Suite (Blind Ground Truth)...');

  const groundTruthPath = path.join(process.cwd(), 'benchmarks/ground_truth.json');
  const groundTruth: GroundTruthItem[] = JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8'));

  const baseDir = path.join(process.cwd(), 'benchmarks/real_world');

  const db = await getDb();
  const orgId = `org-realbench-${Date.now()}`;
  await db.run('INSERT INTO organizations (id, name, country, sector) VALUES (?, ?, ?, ?)', [orgId, 'Real-World Bench Org', 'ES', 'Testing']);

  const connId = `conn-realbench-${Date.now()}`;
  await db.run(
    'INSERT INTO connectors (id, org_id, type, name, status, permissions_scope) VALUES (?, ?, "github", "Real Bench Conn", "active", "read-only")',
    [connId, orgId]
  );

  let agentTP = 0, agentTN = 0, agentFP = 0, agentFN = 0;
  let frameworkTP = 0, frameworkFP = 0;
  let providerTP = 0, providerFP = 0;

  // Calibration Buckets
  const buckets: { [key: string]: { total: number; correct: number } } = {
    '0.50-0.69': { total: 0, correct: 0 },
    '0.70-0.79': { total: 0, correct: 0 },
    '0.80-0.89': { total: 0, correct: 0 },
    '0.90-1.00': { total: 0, correct: 0 }
  };

  console.log('-----------------------------------------------------------------------------------------------');
  console.log('| Repo ID                      | Ground Truth | Detected Agent | Framework Match | Result      |');
  console.log('-----------------------------------------------------------------------------------------------');

  for (const item of groundTruth) {
    const repoPath = path.join(baseDir, item.repoId);
    
    // ANONYMIZE / BLIND REPO PATH: Copy contents to temp dir without repo name to avoid name leakage
    const tempDir = path.join(process.cwd(), `benchmarks/temp_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    fs.cpSync(repoPath, tempDir, { recursive: true });

    try {
      const res = await GitHubConnectorV2.runDiscovery(orgId, connId, tempDir);
      const agent = res.agents[0];
      const isDetected = Boolean(agent && agent.framework !== 'NONE');

      if (item.isAgent && isDetected) {
        agentTP++;
        if (agent.framework === item.framework) {
          frameworkTP++;
          console.log(`| ${item.repoId.padEnd(28)} | POSITIVE     | YES            | ${agent.framework.padEnd(15)} | ✅ TP MATCH |`);
        } else {
          frameworkFP++;
          console.log(`| ${item.repoId.padEnd(28)} | POSITIVE     | YES            | ${agent.framework.padEnd(15)} | ⚠️ FRAMEWORK |`);
        }

        // Calibrate Confidence
        const conf = agent.provenance?.confidence || 0.5;
        const bKey = conf >= 0.9 ? '0.90-1.00' : conf >= 0.8 ? '0.80-0.89' : conf >= 0.7 ? '0.70-0.79' : '0.50-0.69';
        buckets[bKey].total++;
        if (agent.framework === item.framework) buckets[bKey].correct++;

      } else if (!item.isAgent && !isDetected) {
        agentTN++;
        console.log(`| ${item.repoId.padEnd(28)} | NEGATIVE     | NO             | NONE            | ✅ TN CLEAN |`);
      } else if (item.isAgent && !isDetected) {
        agentFN++;
        console.log(`| ${item.repoId.padEnd(28)} | POSITIVE     | NO             | NONE            | ❌ FN MISS  |`);
      } else if (!item.isAgent && isDetected) {
        agentFP++;
        console.log(`| ${item.repoId.padEnd(28)} | NEGATIVE     | YES (FP)       | ${agent.framework.padEnd(15)} | 💥 FP ALARM |`);
      }

    } finally {
      // Cleanup temp dir
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  console.log('-----------------------------------------------------------------------------------------------\n');

  const precision = Math.round((agentTP / (agentTP + agentFP || 1)) * 100);
  const recall = Math.round((agentTP / (agentTP + agentFN || 1)) * 100);
  const f1 = Math.round((2 * precision * recall) / (precision + recall || 1));

  console.log('📊 GRANULAR ADVERSARIAL BENCHMARK METRICS:');
  console.log(`   - Total Repositories Evaluated: ${groundTruth.length}`);
  console.log(`   - Agent True Positives (TP): ${agentTP}`);
  console.log(`   - Agent True Negatives (TN): ${agentTN}`);
  console.log(`   - Agent False Positives (FP): ${agentFP}`);
  console.log(`   - Agent False Negatives (FN): ${agentFN}`);
  console.log(`   - Agent Detection Precision: ${precision}%`);
  console.log(`   - Agent Detection Recall: ${recall}%`);
  console.log(`   - Agent Detection F1 Score: ${f1}%\n`);

  console.log('📈 CONFIDENCE CALIBRATION BUCKETS (Predicted vs Observed Correctness):');
  for (const [bKey, data] of Object.entries(buckets)) {
    const acc = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    console.log(`   - Bucket [${bKey}]: ${data.correct}/${data.total} correct (${acc}% accuracy)`);
  }
  console.log('\n');

  assert.ok(precision >= 85, 'Agent detection precision must be at least 85%');
  assert.ok(agentFP <= 2, 'False positives on negative control repos must be strictly <= 2');
}

runRealWorldBenchmark().catch(err => {
  console.error('❌ Real-World Benchmark Failed:', err);
  process.exit(1);
});
