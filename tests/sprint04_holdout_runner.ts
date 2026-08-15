import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ScannerCore } from '../src/scanner/scannerCore.js';

interface HoldoutEntry {
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
  primaryAssetType: string;
  framework: string;
  provider: string;
  capabilities: string[];
  ground_truth_confidence: number;
  ground_truth_notes: string;
}

async function runSprint04HoldoutEvaluation() {
  console.log('🚀 EXECUTING SPRINT 04 HOLDOUT EVALUATION (FROZEN SCANNER CORE V4)...');

  // 1. Verify Freeze
  const freezePath = path.join(process.cwd(), 'SPRINT04_EVALUATION_FREEZE.json');
  const freezeData = JSON.parse(fs.readFileSync(freezePath, 'utf-8'));

  const scannerContent = fs.readFileSync(path.join(process.cwd(), 'src/scanner/scannerCore.ts'), 'utf-8');
  const currentScannerHash = crypto.createHash('sha256').update(scannerContent).digest('hex');

  if (currentScannerHash !== freezeData.SCANNER_SHA256) {
    console.error('❌ FREEZE VIOLATION: Scanner code modified after freezing!');
    process.exit(1);
  }
  console.log('   🔒 Freeze Integrity Verified: 100% Match with SPRINT04_EVALUATION_FREEZE.json\n');

  // 2. Load Manifest & Ground Truth
  const manifestList: HoldoutEntry[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'SPRINT04_HOLDOUT_MANIFEST.json'), 'utf-8'));
  const groundTruthList: GroundTruthItem[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'benchmarks/holdout/ground-truth.json'), 'utf-8'));

  const rawResults: any[] = [];
  const errorAnalysis: any[] = [];

  let agentTP = 0, agentTN = 0, agentFP = 0, agentFN = 0;

  // Asset Confusion Matrix
  const confusionMatrix: { [gtType: string]: { [predType: string]: number } } = {};

  // Capability Metrics
  let allCapTP = 0, allCapFP = 0, allCapFN = 0;
  let critCapTP = 0, critCapFP = 0, critCapFN = 0;
  const criticalActions = ['DELETE', 'EXECUTE', 'SEND', 'PUBLISH', 'APPROVE', 'PURCHASE', 'TRANSFER', 'ADMIN'];

  console.log('----------------------------------------------------------------------------------------------------------------------');
  console.log('| ID    | Ground Truth Asset | Detected Asset Type | Is Agent GT/TA | Framework Match               | Result          |');
  console.log('----------------------------------------------------------------------------------------------------------------------');

  for (const manifest of manifestList) {
    const gt = groundTruthList.find(g => g.benchmark_id === manifest.benchmark_id)!;
    const repoPath = path.join(process.cwd(), 'benchmarks/holdout/repos', manifest.benchmark_id);

    const scanRes = await ScannerCore.scanRepository(repoPath);
    const asset = scanRes.assets[0];

    const isAgentDetected = asset.primaryAssetType === 'AGENT';

    // Confusion Matrix tracking
    if (!confusionMatrix[gt.primaryAssetType]) confusionMatrix[gt.primaryAssetType] = {};
    if (!confusionMatrix[gt.primaryAssetType][asset.primaryAssetType]) {
      confusionMatrix[gt.primaryAssetType][asset.primaryAssetType] = 0;
    }
    confusionMatrix[gt.primaryAssetType][asset.primaryAssetType]++;

    let resultTag = '';
    if (gt.agent_exists && isAgentDetected) {
      agentTP++;
      resultTag = '✅ MATCH (TP)';
    } else if (!gt.agent_exists && !isAgentDetected) {
      agentTN++;
      resultTag = '✅ CLEAN (TN)';
    } else if (gt.agent_exists && !isAgentDetected) {
      agentFN++;
      resultTag = '❌ FN MISS';
      errorAnalysis.push({
        benchmark_id: manifest.benchmark_id,
        type: 'AGENT_FALSE_NEGATIVE',
        root_cause: 'CUSTOM_AGENT_PATTERN',
        description: `Agent framework ${gt.framework} was not bound as an AGENT.`
      });
    } else if (!gt.agent_exists && isAgentDetected) {
      agentFP++;
      resultTag = '💥 FP ALARM';
      errorAnalysis.push({
        benchmark_id: manifest.benchmark_id,
        type: 'AGENT_FALSE_POSITIVE',
        root_cause: 'TOOL_NOT_AGENT_BOUND',
        description: `Asset ${asset.primaryAssetType} over-classified as AGENT.`
      });
    }

    // Capability Inference evaluation
    const detectedCaps = asset.capabilities.map(c => c.action);

    // All capabilities
    for (const dCap of detectedCaps) {
      if (gt.capabilities.includes(dCap)) {
        allCapTP++;
      } else {
        allCapFP++;
      }
    }
    for (const gCap of gt.capabilities) {
      if (!detectedCaps.includes(gCap)) {
        allCapFN++;
      }
    }

    // Critical Capabilities ONLY
    for (const dCap of detectedCaps.filter(c => criticalActions.includes(c))) {
      if (gt.capabilities.includes(dCap)) {
        critCapTP++;
      } else {
        critCapFP++;
        errorAnalysis.push({
          benchmark_id: manifest.benchmark_id,
          type: 'CRITICAL_CAPABILITY_FALSE_POSITIVE',
          action: dCap,
          description: `Critical capability ${dCap} inferred without entrypoint reachability.`
        });
      }
    }
    for (const gCap of gt.capabilities.filter(c => criticalActions.includes(c))) {
      if (!detectedCaps.includes(gCap)) {
        critCapFN++;
      }
    }

    console.log(
      `| ${manifest.benchmark_id.padEnd(5)} | ${gt.primaryAssetType.padEnd(18)} | ${asset.primaryAssetType.padEnd(19)} | ${(gt.agent_exists ? 'TRUE ' : 'FALSE') + ' / ' + (isAgentDetected ? 'TRUE ' : 'FALSE')}`.padEnd(52) +
      `| ${(gt.framework + ' / ' + asset.framework).padEnd(29)} | ${resultTag.padEnd(15)} |`
    );

    rawResults.push({
      benchmark_id: manifest.benchmark_id,
      origin_url: manifest.origin_url,
      commit_sha: manifest.commit_sha,
      license: manifest.license,
      ground_truth: gt,
      scanner_output: asset,
      unbound_potential_functionalities: scanRes.potentialFunctionalitiesNotBound
    });
  }

  console.log('----------------------------------------------------------------------------------------------------------------------\n');

  // Compute Metrics
  const agentPrecision = Math.round((agentTP / (agentTP + agentFP || 1)) * 100);
  const agentRecall = Math.round((agentTP / (agentTP + agentFN || 1)) * 100);
  const agentF1 = Math.round((2 * agentPrecision * agentRecall) / (agentPrecision + agentRecall || 1));

  const allCapPrecision = Math.round((allCapTP / (allCapTP + allCapFP || 1)) * 100);
  const allCapRecall = Math.round((allCapTP / (allCapTP + allCapFN || 1)) * 100);
  const allCapFPRate = Math.round((allCapFP / (allCapTP + allCapFP || 1)) * 100);

  const critCapPrecision = Math.round((critCapTP / (critCapTP + critCapFP || 1)) * 100);

  const metricsData = {
    agent_detection: {
      total_repos: manifestList.length,
      true_positives: agentTP,
      true_negatives: agentTN,
      false_positives: agentFP,
      false_negatives: agentFN,
      precision_pct: agentPrecision,
      recall_pct: agentRecall,
      f1_score_pct: agentF1
    },
    asset_confusion_matrix: confusionMatrix,
    capability_metrics: {
      all_capabilities: {
        tp: allCapTP,
        fp: allCapFP,
        fn: allCapFN,
        precision_pct: allCapPrecision,
        recall_pct: allCapRecall,
        fp_rate_pct: allCapFPRate
      },
      critical_capabilities: {
        tp: critCapTP,
        fp: critCapFP,
        fn: critCapFN,
        critical_fp_count: critCapFP,
        precision_pct: critCapPrecision
      }
    }
  };

  fs.writeFileSync(path.join(process.cwd(), 'sprint04-raw-results.json'), JSON.stringify(rawResults, null, 2), 'utf-8');
  fs.writeFileSync(path.join(process.cwd(), 'sprint04-metrics.json'), JSON.stringify(metricsData, null, 2), 'utf-8');
  fs.writeFileSync(path.join(process.cwd(), 'sprint04-error-analysis.json'), JSON.stringify(errorAnalysis, null, 2), 'utf-8');

  console.log('🏆 SPRINT 04 HOLDOUT EVALUATION METRICS SUMMARY:');
  console.log(`   - Repositories Evaluated: ${manifestList.length}`);
  console.log(`   - Agent True Positives (TP): ${agentTP}`);
  console.log(`   - Agent True Negatives (TN): ${agentTN}`);
  console.log(`   - Agent False Positives (FP): ${agentFP}`);
  console.log(`   - Agent False Negatives (FN): ${agentFN}`);
  console.log(`   - AGENT DETECTION PRECISION: ${agentPrecision}%`);
  console.log(`   - AGENT DETECTION RECALL: ${agentRecall}%`);
  console.log(`   - AGENT DETECTION F1 SCORE: ${agentF1}%\n`);

  console.log('⚡ CAPABILITY BINDING & CRITICAL CAPABILITY PRECISION:');
  console.log(`   - ALL CAPABILITY PRECISION: ${allCapPrecision}%`);
  console.log(`   - ALL CAPABILITY RECALL: ${allCapRecall}%`);
  console.log(`   - CRITICAL CAPABILITY FALSE POSITIVES (EXECUTE/DELETE/SEND/etc): ${critCapFP}`);
  console.log(`   - CRITICAL CAPABILITY PRECISION: ${critCapPrecision}%\n`);
}

runSprint04HoldoutEvaluation().catch(err => {
  console.error('❌ Holdout Runner Failed:', err);
  process.exit(1);
});
