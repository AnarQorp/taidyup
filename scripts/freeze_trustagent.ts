import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const getFileHash = (filePath: string): string => {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
};

const collectorPath = path.join(process.cwd(), 'src/backend/connectors/githubConnector.ts');
const rulesetPath = path.join(process.cwd(), 'src/backend/services/applicabilityEngine.ts');
const confidencePath = path.join(process.cwd(), 'src/backend/services/evidenceEngine.ts');
const manifestPath = path.join(process.cwd(), 'benchmarks/external/corpus-manifest.json');

const freezeData = {
  COLLECTOR_VERSION: '3.0.0',
  COLLECTOR_SHA256: getFileHash(collectorPath),
  RULESET_SHA256: getFileHash(rulesetPath),
  CONFIDENCE_MODEL_SHA256: getFileHash(confidencePath),
  CORPUS_MANIFEST_SHA256: getFileHash(manifestPath),
  FROZEN_AT: new Date().toISOString(),
  STATUS: 'FROZEN_FOR_EXTERNAL_BENCHMARK'
};

const freezePath = path.join(process.cwd(), 'EXTERNAL_BENCHMARK_FREEZE.json');
fs.writeFileSync(freezePath, JSON.stringify(freezeData, null, 2), 'utf-8');

console.log('🔒 TRUSTAGENT FROZEN SUCCESSFULLY FOR EXTERNAL REALITY CHECK:');
console.log(JSON.stringify(freezeData, null, 2));
