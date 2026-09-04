import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ScannerCore } from '../src/scanner/scannerCore.js';

async function main(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-provider-semantics-red-'));
  try {
    fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "configurable-ai-tool"\ndependencies = ["anthropic"]\n');
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    assert.equal(asset.provider, 'UNKNOWN', 'an optional/supported dependency does not prove an active provider');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error('KNOWN RED — DEFERRED provider semantics:', error);
  process.exitCode = 1;
});
