import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from '../src/backend/db.js';
import { GitHubConnectorV2 } from '../src/backend/connectors/githubConnector.js';

interface ManifestEntry {
  benchmark_id: string;
  origin_url: string;
  commit_sha: string;
  license: string;
  fetched_at: string;
  snapshot_hash: string;
  selection_reason: string;
}

interface GroundTruthItem {
  benchmark_id: string;
  agent_exists: boolean;
  provider: string;
  framework: string;
  protocol: string;
  tools: string[];
  capabilities: string[];
  credential_dependencies: string[];
  human_oversight: string;
  revocation: string;
  authority_constraints: string;
  ground_truth_confidence: number;
  ground_truth_notes: string;
}

async function runExternalBenchmark() {
  console.log('🔥 EXECUTING EXTERNAL REALITY CHECK...');

  // 1. Verify Freeze Integrity
  const freezePath = path.join(process.cwd(), 'EXTERNAL_BENCHMARK_FREEZE.json');
  const freezeData = JSON.parse(fs.readFileSync(freezePath, 'utf-8'));

  const collectorContent = fs.readFileSync(path.join(process.cwd(), 'src/backend/connectors/githubConnector.ts'), 'utf-8');
  const currentCollectorHash = crypto.createHash('sha256').update(collectorContent).digest('hex');

  if (currentCollectorHash !== freezeData.COLLECTOR_SHA256) {
    console.error('❌ FREEZE VIOLATION: Collector code was modified after freezing!');
    process.exit(1);
  }
  console.log('   🔒 Freeze Integrity Verified: 100% Match with EXTERNAL_BENCHMARK_FREEZE.json');

  // 2. Load Manifest & Ground Truth
  const manifestList: ManifestEntry[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'benchmarks/external/corpus-manifest.json'), 'utf-8'));
  const groundTruthList: GroundTruthItem[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'benchmarks/external/ground-truth.json'), 'utf-8'));

  const db = await getDb();
  const orgId = `org-extbench-${Date.now()}`;
  await db.run('INSERT INTO organizations (id, name, country, sector) VALUES (?, ?, ?, ?)', [orgId, 'External Reality Check Org', 'ES', 'Benchmarking']);

  const connId = `conn-extbench-${Date.now()}`;
  await db.run(
    'INSERT INTO connectors (id, org_id, type, name, status, permissions_scope) VALUES (?, ?, "github", "Ext Conn", "active", "read-only")',
    [connId, orgId]
  );

  const rawResults: any[] = [];
  let agentTP = 0, agentTN = 0, agentFP = 0, agentFN = 0;

  // Capability Metrics
  let capTP = 0, capFP = 0, capFN = 0;
  let criticalCapFP = 0;
  const criticalCapabilities = ['DELETE', 'EXECUTE', 'SEND', 'PUBLISH', 'APPROVE', 'PURCHASE', 'TRANSFER', 'ADMIN'];

  // Confidence Buckets
  const confidenceBuckets: { [key: string]: { claims: number; correct: number; incorrect: number; unknown: number } } = {
    '0.50-0.69': { claims: 0, correct: 0, incorrect: 0, unknown: 0 },
    '0.70-0.79': { claims: 0, correct: 0, incorrect: 0, unknown: 0 },
    '0.80-0.89': { claims: 0, correct: 0, incorrect: 0, unknown: 0 },
    '0.90-1.00': { claims: 0, correct: 0, incorrect: 0, unknown: 0 }
  };

  const errorAnalysis: any[] = [];

  console.log('\n---------------------------------------------------------------------------------------------------------');
  console.log('| ID     | Ground Truth | tAIdyup Result    | Framework GT / TA              | Result Classification    |');
  console.log('---------------------------------------------------------------------------------------------------------');

  for (const manifest of manifestList) {
    const gt = groundTruthList.find(g => g.benchmark_id === manifest.benchmark_id)!;
    const repoPath = path.join(process.cwd(), 'benchmarks/external/repos', manifest.benchmark_id);

    const discovery = await GitHubConnectorV2.runDiscovery(orgId, connId, repoPath);
    const agent = discovery.agents[0];
    const isDetected = Boolean(agent && agent.framework !== 'NONE');

    let agentResultClassification = '';

    if (gt.agent_exists && isDetected) {
      agentTP++;
      agentResultClassification = 'TRUE_POSITIVE';
      console.log(`| ${manifest.benchmark_id.padEnd(6)} | AGENT=TRUE   | AGENT=TRUE        | ${(gt.framework + ' / ' + agent.framework).padEnd(28)} | ✅ MATCH (TP)            |`);
    } else if (!gt.agent_exists && !isDetected) {
      agentTN++;
      agentResultClassification = 'TRUE_NEGATIVE';
      console.log(`| ${manifest.benchmark_id.padEnd(6)} | AGENT=FALSE  | AGENT=FALSE       | ${(gt.framework + ' / NONE').padEnd(28)} | ✅ CLEAN (TN)            |`);
    } else if (gt.agent_exists && !isDetected) {
      agentFN++;
      agentResultClassification = 'FALSE_NEGATIVE';
      console.log(`| ${manifest.benchmark_id.padEnd(6)} | AGENT=TRUE   | AGENT=FALSE       | ${(gt.framework + ' / NONE').padEnd(28)} | ❌ FN MISS               |`);
      errorAnalysis.push({
        benchmark_id: manifest.benchmark_id,
        type: 'FALSE_NEGATIVE',
        root_cause: 'IMPORT_NOT_REACHABLE',
        description: `Agent framework ${gt.framework} existed in repo but static AST scanner failed to bind agent signal.`
      });
    } else if (!gt.agent_exists && isDetected) {
      agentFP++;
      agentResultClassification = 'FALSE_POSITIVE';
      console.log(`| ${manifest.benchmark_id.padEnd(6)} | AGENT=FALSE  | AGENT=TRUE        | ${(gt.framework + ' / ' + agent.framework).padEnd(28)} | 💥 FP ALARM              |`);
      errorAnalysis.push({
        benchmark_id: manifest.benchmark_id,
        type: 'FALSE_POSITIVE',
        root_cause: 'TOOL_NOT_AGENT_BOUND',
        description: `Framework ${agent.framework} present in repository dependencies/sources without autonomous agent loop.`
      });
    }

    // Evaluate Capability Inference & Critical Capability FPs
    const inferredCaps = agent ? agent.capabilities.map(c => c.capability) : [];
    for (const cap of inferredCaps) {
      if (gt.capabilities.includes(cap)) {
        capTP++;
      } else {
        capFP++;
        if (criticalCapabilities.includes(cap)) {
          criticalCapFP++;
        }
      }
    }
    for (const gtCap of gt.capabilities) {
      if (!inferredCaps.includes(gtCap)) {
        capFN++;
      }
    }

    // Calibration bucket evaluation
    if (agent) {
      const conf = agent.provenance?.confidence || 0.5;
      const bKey = conf >= 0.9 ? '0.90-1.00' : conf >= 0.8 ? '0.80-0.89' : conf >= 0.7 ? '0.70-0.79' : '0.50-0.69';
      confidenceBuckets[bKey].claims++;
      if (agentResultClassification === 'TRUE_POSITIVE') {
        confidenceBuckets[bKey].correct++;
      } else {
        confidenceBuckets[bKey].incorrect++;
      }
    }

    rawResults.push({
      benchmark_id: manifest.benchmark_id,
      origin_url: manifest.origin_url,
      commit_sha: manifest.commit_sha,
      license: manifest.license,
      ground_truth: gt,
      trustagent_output: {
        is_detected: isDetected,
        agent: agent || null,
        evidences_recorded: discovery.evidencesRecorded
      },
      classification: agentResultClassification
    });
  }

  console.log('---------------------------------------------------------------------------------------------------------\n');

  // Compute Metrics
  const precision = Math.round((agentTP / (agentTP + agentFP || 1)) * 100);
  const recall = Math.round((agentTP / (agentTP + agentFN || 1)) * 100);
  const f1 = Math.round((2 * precision * recall) / (precision + recall || 1));

  const capPrecision = Math.round((capTP / (capTP + capFP || 1)) * 100);
  const capRecall = Math.round((capTP / (capTP + capFN || 1)) * 100);
  const capFPRate = Math.round((capFP / (capTP + capFP || 1)) * 100);

  const metricsData = {
    agent_detection: {
      total_repos: manifestList.length,
      true_positives: agentTP,
      true_negatives: agentTN,
      false_positives: agentFP,
      false_negatives: agentFN,
      precision_pct: precision,
      recall_pct: recall,
      f1_score_pct: f1
    },
    capability_inference: {
      cap_true_positives: capTP,
      cap_false_positives: capFP,
      cap_false_negatives: capFN,
      critical_capability_false_positives: criticalCapFP,
      capability_precision_pct: capPrecision,
      capability_recall_pct: capRecall,
      capability_false_positive_rate_pct: capFPRate
    },
    confidence_calibration: confidenceBuckets
  };

  // Write Result JSON Files
  fs.writeFileSync(path.join(process.cwd(), 'raw-results.json'), JSON.stringify(rawResults, null, 2), 'utf-8');
  fs.writeFileSync(path.join(process.cwd(), 'metrics.json'), JSON.stringify(metricsData, null, 2), 'utf-8');
  fs.writeFileSync(path.join(process.cwd(), 'error-analysis.json'), JSON.stringify(errorAnalysis, null, 2), 'utf-8');

  console.log('📊 SPRINT 03B EXTERNAL REALITY CHECK METRICS SUMMARY:');
  console.log(`   - Repositories Evaluated: ${manifestList.length}`);
  console.log(`   - Agent True Positives (TP): ${agentTP}`);
  console.log(`   - Agent True Negatives (TN): ${agentTN}`);
  console.log(`   - Agent False Positives (FP): ${agentFP}`);
  console.log(`   - Agent False Negatives (FN): ${agentFN}`);
  console.log(`   - Agent Precision: ${precision}%`);
  console.log(`   - Agent Recall: ${recall}%`);
  console.log(`   - Agent F1 Score: ${f1}%\n`);

  console.log('⚠️ CAPABILITY METRICS & CRITICAL FALSE POSITIVES:');
  console.log(`   - Capability Precision: ${capPrecision}%`);
  console.log(`   - Capability Recall: ${capRecall}%`);
  console.log(`   - Capability False Positive Rate: ${capFPRate}%`);
  console.log(`   - CRITICAL CAPABILITY FALSE POSITIVES (EXECUTE/DELETE/SEND/etc): ${criticalCapFP}\n`);
}

runExternalBenchmark().catch(err => {
  console.error('❌ External Benchmark Runner Failed:', err);
  process.exit(1);
});
