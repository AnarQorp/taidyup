import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import packageMetadata from '../package.json';
import { CliCore } from '../src/cli/cliCore.js';
import { SarifExporter } from '../src/cli/sarifExporter.js';
import fs from 'node:fs';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (...args: string[]) => spawnSync(process.execPath, ['bin/taidyup.js', ...args], {
  cwd: root,
  encoding: 'utf8'
});

assert.equal(CliCore.VERSION, packageMetadata.version);

for (const flag of ['--version', '-v']) {
  const result = run(flag);
  assert.equal(result.status, 0, `${flag} must exit successfully: ${result.stderr}`);
  assert.equal(result.stdout.trim(), `taidyup v${packageMetadata.version}`);
}

for (const flag of ['--help', '-h']) {
  const result = run(flag);
  assert.equal(result.status, 0, `${flag} must exit successfully: ${result.stderr}`);
  assert.match(result.stdout, new RegExp(`tAIdyup CLI v${packageMetadata.version.replaceAll('.', '\\.')}`));
  assert.match(result.stdout, /Manifestless projects are valid analysis targets/);
}

const sarif = SarifExporter.exportToSarif('version-contract', {
  schemaVersion: '1.2.0', timestamp: new Date(0).toISOString(),
  summary: { totalClaims: 0, supportedCount: 0, unverifiedCount: 0, conflictCount: 0, undeclaredCount: 0, unknownCount: 0, criticalFindingsCount: 0 },
  reconciledClaims: [], findings: []
} as any);
assert.equal(sarif.runs[0].tool.driver.version, packageMetadata.version);

const target = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-json-contract-'));
try {
  fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name: 'json-contract' }));
  const jsonResult = run('scan', target, '--json');
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  assert.equal(JSON.parse(jsonResult.stdout).scannedPath, target, '`scan --json` must emit parseable JSON without human preamble');
} finally {
  fs.rmSync(target, { recursive: true, force: true });
}

console.log('CLI version contract tests passed.');
