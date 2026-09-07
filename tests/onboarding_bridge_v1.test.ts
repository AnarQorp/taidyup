import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { analyzeBundledDemo } from '../src/application/analyzeBundledDemo.js';
import { pickerCommands, PICKER_MAX_OUTPUT_BYTES, PICKER_TIMEOUT_MS, selectLocalDirectory } from '../src/local-ui/folderPicker.js';
import { createLocalUiApp } from '../src/local-ui/server.js';
import { ReportGenerator } from '../src/trust-kernel/reportGenerator.js';

type Callback = (error: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void;
const runner = (value: { error?: NodeJS.ErrnoException; stdout?: string }, inspect?: (file: string, args: string[], options: any) => void) =>
  ((file: string, args: string[], options: any, callback: Callback) => { inspect?.(file, args, options); callback(value.error || null, value.stdout || '', ''); });

async function pickerContract() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-picker-'));
  try {
    const selected = await selectLocalDirectory({ platform: 'linux', runner: runner({ stdout: root }, (file, args, options) => {
      assert.equal(file, 'zenity'); assert.deepEqual(args, ['--file-selection', '--directory', '--title=Choose a local project']);
      assert.equal(options.shell, undefined); assert.equal(options.timeout, PICKER_TIMEOUT_MS); assert.equal(options.maxBuffer, PICKER_MAX_OUTPUT_BYTES);
    }) as any });
    assert.deepEqual(selected, { status: 'SELECTED', path: fs.realpathSync(root) });
    assert.equal((await selectLocalDirectory({ platform: 'linux', runner: runner({ error: Object.assign(new Error(), { code: 1 }) }) as any })).status, 'CANCELLED');
    assert.equal((await selectLocalDirectory({ platform: 'linux', runner: runner({ error: Object.assign(new Error(), { code: 'ENOENT' }) }) as any })).status, 'PICKER_UNAVAILABLE');
    assert.equal((await selectLocalDirectory({ platform: 'linux', runner: runner({ stdout: `${root}\n${root}` }) as any })).status, 'PICKER_FAILED');
    assert.equal((await selectLocalDirectory({ platform: 'linux', runner: runner({ stdout: 'x'.repeat(PICKER_MAX_OUTPUT_BYTES + 1) }) as any })).status, 'PICKER_FAILED');
    assert.equal((await selectLocalDirectory({ platform: 'linux', runner: runner({ error: Object.assign(new Error(), { code: 'ETIMEDOUT', killed: true }) }) as any })).status, 'PICKER_FAILED');
    assert.equal(pickerCommands('darwin')[0].file, '/usr/bin/osascript'); assert.equal(pickerCommands('win32')[0].file, 'powershell.exe'); assert.equal(pickerCommands('freebsd').length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function post(port: number, route: string, body: unknown, origin = `http://127.0.0.1:${port}`): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => { const raw = JSON.stringify(body); const request = http.request({ hostname: '127.0.0.1', port, path: route, method: 'POST', headers: { origin, 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) } }, response => { const chunks: Buffer[] = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => resolve({ status: response.statusCode || 0, body: JSON.parse(Buffer.concat(chunks).toString()) })); }); request.on('error', reject); request.end(raw); });
}

async function bridgeAndDemoContract() {
  const demoRoot = path.resolve('demo/onboarding-v1');
  const server = createLocalUiApp({ demoRoot, selectDirectory: async () => ({ status: 'CANCELLED' }) }).listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address === 'object'); const port = address.port;
  try {
    assert.equal((await post(port, '/local-api/select-directory', {}, 'https://remote.example')).status, 403);
    assert.equal((await post(port, '/local-api/select-directory', { command: 'anything', path: '/tmp' })).body.error.code, 'PICKER_REQUEST_INVALID');
    assert.equal((await post(port, '/local-api/select-directory', {})).body.status, 'CANCELLED');
    assert.equal((await post(port, '/local-api/demo-analysis', {}, 'https://remote.example')).status, 403);
    assert.equal((await post(port, '/local-api/demo-analysis', { demoRoot: '/tmp' })).body.error.code, 'DEMO_REQUEST_INVALID');
    const demo = await post(port, '/local-api/demo-analysis', {}); assert.equal(demo.status, 200);
    assert.deepEqual(demo.body.presentation, { bundledDemo: true, label: 'Bundled onboarding demo' });
    const claims = demo.body.reconciliation.reconciledClaims;
    assert.equal(claims.some((item: any) => item.action === 'SEND' && item.status === 'SUPPORTED'), true);
    assert.equal(claims.some((item: any) => item.action === 'WRITE' && item.status === 'UNVERIFIED'), true);
    assert.equal(claims.some((item: any) => item.action === 'EXECUTE' && item.status === 'UNDECLARED_OBSERVATION'), true);
    const runtimeSend = claims.find((item: any) => item.action === 'SEND' && item.runtimeAssessment?.observationState === 'COMPLETION_OBSERVED');
    assert.equal(runtimeSend.status, 'UNDECLARED_OBSERVATION'); assert.equal(runtimeSend.runtimeAssessment.latestOutcome, 'SUCCEEDED'); assert.equal(runtimeSend.runtimeAssessment.completeness, 'PARTIAL_OBSERVATION');
    assert.equal('connected' in demo.body, false); assert.equal(demo.body.evidence.some((item: any) => item.sourceType === 'CONNECTED'), false); assert.equal(JSON.stringify(demo.body.evidence).includes('bundledDemo'), false);
  } finally { server.close(); await once(server, 'close'); }
  const direct = await analyzeBundledDemo(demoRoot); const passport = ReportGenerator.generateMarkdownReport(direct.project.name, direct.reconciliation);
  assert.doesNotMatch(passport, /bundled demo/i); assert.equal(JSON.stringify(direct.reconciliation).includes('bundledDemo'), false);
  assert.doesNotMatch(fs.readFileSync('src/trust-kernel/reconciliationEngine.ts', 'utf8'), /bundledDemo|onboarding-demo/i);
}

async function main() {
  await pickerContract(); await bridgeAndDemoContract();
  console.log('Onboarding V1 bridge primitives: picker, containment, real demo and local-only contracts PASS');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
