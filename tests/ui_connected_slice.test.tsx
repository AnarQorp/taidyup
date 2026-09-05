import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from '../src/frontend/App.js';
import { AnalysisView, ClaimDetail } from '../src/frontend/components/AnalysisView.js';
import { createLocalUiApp } from '../src/local-ui/server.js';

function post(port: number, body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(body);
    const request = http.request({ hostname: '127.0.0.1', port, path: '/local-api/connected-n8n', method: 'POST', headers: { origin: `http://127.0.0.1:${port}`, 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) } }, response => {
      const chunks: Buffer[] = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => resolve({ status: response.statusCode || 0, body: JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    request.on('error', reject); request.end(raw);
  });
}

async function run() {
  const fixtureRoot = path.resolve('demo/connected-drift');
  const t1Workflow = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'workflow-t1.json'), 'utf8'));
  const t2Workflow = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'workflow-t2.json'), 'utf8'));
  let includeGmail = true;
  const workflow = () => includeGmail ? t1Workflow : t2Workflow;
  const provider = http.createServer((req, res) => { assert.equal(req.headers['x-n8n-api-key'], 'ui-secret-value'); res.setHeader('content-type', 'application/json'); if (req.url?.startsWith('/api/v1/workflows?')) res.end(JSON.stringify({ data: [{ id: 'wf-1', versionId: workflow().versionId }], nextCursor: null })); else res.end(JSON.stringify(workflow())); }).listen(0, '127.0.0.1');
  await once(provider, 'listening'); const providerAddress = provider.address(); assert.ok(providerAddress && typeof providerAddress === 'object');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-ui-connected-'));
  fs.copyFileSync(path.join(fixtureRoot, 'project', 'taidyup.json'), path.join(root, 'taidyup.json'));
  process.env.TAIDYUP_UI_CONNECTED_TOKEN = 'ui-secret-value';
  const bridge = createLocalUiApp().listen(0, '127.0.0.1'); await once(bridge, 'listening'); const bridgeAddress = bridge.address(); assert.ok(bridgeAddress && typeof bridgeAddress === 'object');
  const request = { targetPath: root, baseUrl: `http://127.0.0.1:${providerAddress.port}`, workflowId: 'wf-1', connectionId: 'synthetic-ui', tokenEnv: 'TAIDYUP_UI_CONNECTED_TOKEN', authorityMode: 'CLIENT_ENFORCED_READ_ONLY', allowLoopbackHttp: true };
  try {
    const t1 = await post(bridgeAddress.port, request); assert.equal(t1.status, 200); assert.equal(t1.body.reconciliation.reconciledClaims.find((item: any) => item.action === 'SEND')?.status, 'SUPPORTED');
    assert.doesNotMatch(JSON.stringify(t1.body), /ui-secret-value/);
    const t1Html = renderToStaticMarkup(<AnalysisView state={{ status: 'success', result: t1.body }} />); assert.match(t1Html, /Latest inspected snapshot/); assert.match(t1Html, /n8n:synthetic-ui:/); assert.match(t1Html, /CONNECTED/); assert.match(t1Html, /Runtime/); assert.match(t1Html, /Unavailable/);
    includeGmail = false;
    const t2 = await post(bridgeAddress.port, request); assert.equal(t2.status, 200); const claim = t2.body.reconciliation.reconciledClaims.find((item: any) => item.action === 'SEND'); assert.equal(claim.status, 'UNVERIFIED'); assert.ok(claim.assessment.diagnostics.includes('CURRENT_STATE_DRIFT')); assert.equal(t2.body.connected.absenceEvidences.length, 1);
    const detail = renderToStaticMarkup(<ClaimDetail claim={claim} result={t2.body} onClose={() => {}} />); assert.match(detail, /ABSENCE_OBSERVED/); assert.match(detail, /CURRENT_STATE_DRIFT/); assert.doesNotMatch(detail, /ui-secret-value|AUTHORIZED|EXECUTED/);
    const shell = renderToStaticMarkup(<App />); assert.match(shell, /OPT-IN/); assert.match(shell, /Token value stays in the local Node process/); assert.doesNotMatch(shell, /type="password"/);
  } finally {
    delete process.env.TAIDYUP_UI_CONNECTED_TOKEN; provider.close(); bridge.close(); await Promise.all([once(provider, 'close'), once(bridge, 'close')]); fs.rmSync(root, { recursive: true, force: true });
  }
  console.log('GUI CONNECTED product slice: T1/T2, provenance, absence and secret boundary PASS');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
