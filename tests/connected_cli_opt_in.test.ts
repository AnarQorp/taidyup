import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { CliCore } from '../src/cli/cliCore.js';

async function main(): Promise<void> {
  const originalFetch = globalThis.fetch; let defaultNetworkCalls = 0;
  globalThis.fetch = (async () => { defaultNetworkCalls++; throw new Error('unexpected network'); }) as typeof fetch;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-connected-cli-'));
  try {
    assert.equal(await CliCore.execute({ command: 'scan', targetPath: temp, json: true }), 0);
    assert.equal(defaultNetworkCalls, 0, 'default local scan must not call fetch');
  } finally { globalThis.fetch = originalFetch; fs.rmSync(temp, { recursive: true, force: true }); }

  const requests: string[] = [];
  const workflow = { id: 'wf-1', name: 'CLI workflow', active: false, nodes: [], connections: {} };
  const api = http.createServer((req, res) => { requests.push(`${req.method} ${req.url}`); res.setHeader('content-type', 'application/json'); res.end(req.url?.startsWith('/api/v1/workflows?') ? JSON.stringify({ data: [{ id: 'wf-1' }], nextCursor: null }) : JSON.stringify(workflow)); }).listen(0, '127.0.0.1');
  await once(api, 'listening'); const address = api.address(); if (!address || typeof address === 'string') throw new Error('address');
  const logs: string[] = []; const priorLog = console.log; const priorToken = process.env.TAIDYUP_TEST_N8N_TOKEN; console.log = (...args) => logs.push(args.join(' ')); process.env.TAIDYUP_TEST_N8N_TOKEN = 'CLI-SECRET';
  try {
    const code = await CliCore.execute({ command: 'connected-n8n', targetPath: '.', baseUrl: `http://127.0.0.1:${address.port}`, workflowId: 'wf-1', tokenEnv: 'TAIDYUP_TEST_N8N_TOKEN', authorityMode: 'CLIENT_ENFORCED_READ_ONLY', connectionId: 'cli-test', allowLoopbackHttp: true });
    assert.equal(code, 0); assert.equal(requests.length, 2); assert.ok(logs[0].includes('CONNECTED opt-in')); assert.equal(logs.join('\n').includes('CLI-SECRET'), false);
  } finally { console.log = priorLog; if (priorToken === undefined) delete process.env.TAIDYUP_TEST_N8N_TOKEN; else process.env.TAIDYUP_TEST_N8N_TOKEN = priorToken; api.close(); await once(api, 'close'); }
  console.log('CONNECTED CLI explicit opt-in/default no-network PASS');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
