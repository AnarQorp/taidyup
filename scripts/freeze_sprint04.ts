import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const getFileHash = (filePath: string): string => {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
};

const scannerPath = path.join(process.cwd(), 'src/scanner/scannerCore.ts');
const rulesetPath = path.join(process.cwd(), 'src/scanner/types.ts');
const confidencePath = path.join(process.cwd(), 'src/backend/services/evidenceEngine.ts');
const devCorpusPath = path.join(process.cwd(), 'benchmarks/external/corpus-manifest.json');
const holdoutManifestPath = path.join(process.cwd(), 'SPRINT04_HOLDOUT_MANIFEST.json');

const freezeData = {
  SCANNER_VERSION: '4.0.0-open-core',
  SCANNER_SHA256: getFileHash(scannerPath),
  RULESET_SHA256: getFileHash(rulesetPath),
  CONFIDENCE_MODEL_SHA256: getFileHash(confidencePath),
  ONTOLOGY_VERSION: '4.0.0',
  DEVELOPMENT_CORPUS_SHA256: getFileHash(devCorpusPath),
  HOLDOUT_MANIFEST_SHA256: getFileHash(holdoutManifestPath),
  FROZEN_AT: new Date().toISOString(),
  STATUS: 'FROZEN_FOR_SPRINT04_HOLDOUT_EVALUATION'
};

const freezePath = path.join(process.cwd(), 'SPRINT04_EVALUATION_FREEZE.json');
fs.writeFileSync(freezePath, JSON.stringify(freezeData, null, 2), 'utf-8');

console.log('🔒 SPRINT 04 HOLDOUT EVALUATION FROZEN SUCCESSFULLY:');
console.log(JSON.stringify(freezeData, null, 2));
