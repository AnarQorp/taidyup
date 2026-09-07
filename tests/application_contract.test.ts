import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { analyzeLocalProject, ProjectAnalysisError } from '../src/application/analyzeLocalProject.js';
import { ScannerCore } from '../src/scanner/scannerCore.js';
import { ManifestParser } from '../src/trust-kernel/manifestParser.js';
import { ScannerAdapter } from '../src/trust-kernel/scannerAdapter.js';
import { ReconciliationEngine } from '../src/trust-kernel/reconciliationEngine.js';
import { CliCore } from '../src/cli/cliCore.js';

async function captureCli(options: Parameters<typeof CliCore.execute>[0]) {
  const output: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => output.push(args.join(' '));
  console.error = (...args: unknown[]) => output.push(args.join(' '));
  try {
    return { exitCode: await CliCore.execute(options), output: output.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-application-contract-'));
  try {
    await assert.rejects(
      () => analyzeLocalProject('https://github.com/example/project.git'),
      (error: unknown) => error instanceof ProjectAnalysisError && error.code === 'REMOTE_TARGET_NOT_SUPPORTED'
    );

    await assert.rejects(
      () => analyzeLocalProject(path.join(tempRoot, 'missing')),
      (error: unknown) => error instanceof ProjectAnalysisError && error.code === 'TARGET_NOT_FOUND'
    );

    const fileTarget = path.join(tempRoot, 'project.ts');
    fs.writeFileSync(fileTarget, 'export const value = 1;\n');
    await assert.rejects(
      () => analyzeLocalProject(fileTarget),
      (error: unknown) => error instanceof ProjectAnalysisError && error.code === 'TARGET_NOT_DIRECTORY'
    );

    const noManifestTarget = path.join(tempRoot, 'no-manifest');
    fs.mkdirSync(noManifestTarget);
    await assert.rejects(
      () => analyzeLocalProject(noManifestTarget),
      (error: unknown) => error instanceof ProjectAnalysisError && error.code === 'MANIFEST_NOT_FOUND'
    );

    const projectTarget = path.join(tempRoot, 'project');
    fs.mkdirSync(path.join(projectTarget, 'src'), { recursive: true });
    const manifest = {
      version: '1.0',
      project: 'shared-contract-fixture',
      agents: [{
        id: 'main-agent',
        name: 'Main Agent',
        purpose: 'Exercise the shared application contract',
        owner: { name: 'Fixture Owner', email: 'fixture@example.test' },
        capabilities: [{ action: 'EXECUTE', resource: 'Terminal / OS Shell' }]
      }]
    };
    const manifestPath = path.join(projectTarget, 'taidyup.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(projectTarget, 'package.json'), JSON.stringify({ name: 'fixture' }));
    fs.writeFileSync(path.join(projectTarget, 'src', 'agent.ts'), [
      "import { exec } from 'child_process';",
      "export const shellTool = { name: 'shell', func: (command: string) => exec(command) };"
    ].join('\n'));

    const applicationResult = await analyzeLocalProject(projectTarget);
    const manualManifest = ManifestParser.parseManifest(manifest, manifestPath);
    const manualScan = await ScannerCore.scanRepository(projectTarget);
    const manualScannerOutput = ScannerAdapter.adaptScanResult(manualScan);
    const manualState = ReconciliationEngine.reconcile(
      [...manualManifest.claims, ...manualScannerOutput.claims],
      [...manualManifest.evidences, ...manualScannerOutput.evidences]
    );

    assert.deepStrictEqual(
      { ...applicationResult.reconciliation, timestamp: '<timestamp>' },
      { ...manualState, timestamp: '<timestamp>' },
      'shared application use case must preserve the existing CLI reconciliation flow'
    );
    assert.deepStrictEqual(
      applicationResult.evidence.map(item => item.id),
      [...manualManifest.evidences, ...manualScannerOutput.evidences].map(item => item.id),
      'the UI contract must expose Core evidence without rebuilding it'
    );
    assert.strictEqual(applicationResult.manifest.status, 'DECLARED');
    assert.ok(applicationResult.subjects.includes('agent:main-agent'));

    const cliResult = await captureCli({ command: 'validate', targetPath: projectTarget });
    assert.strictEqual(cliResult.exitCode, 0);
    assert.match(cliResult.output, new RegExp(`Supported:\\s+${applicationResult.reconciliation.summary.supportedCount}\\b`));
    assert.match(cliResult.output, new RegExp(`Unverified:\\s+${applicationResult.reconciliation.summary.unverifiedCount}\\b`));
    assert.match(cliResult.output, new RegExp(`Conflicts:\\s+${applicationResult.reconciliation.summary.conflictCount}\\b`));
    assert.match(cliResult.output, new RegExp(`Undeclared observations:\\s+${applicationResult.reconciliation.summary.undeclaredCount}\\b`));
    assert.match(cliResult.output, /Runtime: No runtime evidence available \(not evidence of no execution\)/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

run()
  .then(() => console.log('✅ Application contract tests passed'))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
