import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { analyzeConnectedN8nWorkflow } from '../src/application/analyzeConnectedN8nWorkflow.js';
import { Claim } from '../src/trust-kernel/types.js';

const agent = { id: 'agent', name: 'Agent', type: '@n8n/n8n-nodes-langchain.agent', typeVersion: 2, parameters: {} };
const gmail = { id: 'gmail', name: 'Mail', type: '@n8n/n8n-nodes-langchain.gmailTool', typeVersion: 2, parameters: { operation: 'send' } };
const disconnected = { id: 'shell', name: 'Disconnected', type: '@n8n/n8n-nodes-langchain.executeCommandTool', typeVersion: 2, parameters: { operation: 'run' } };
const state = { includeGmail: true, revision: 1 };
const current = () => ({ id: 'wf-1', name: 'Synthetic current workflow', active: true, versionId: `draft-${state.revision}`, activeVersionId: 'active-1', nodes: [agent, ...(state.includeGmail ? [gmail] : []), disconnected], connections: state.includeGmail ? { Mail: { ai_tool: [[{ node: 'Agent', type: 'ai_tool', index: 0 }]] } } : {} });

async function main(): Promise<void> {
  const requests: string[] = [];
  const api = http.createServer((req, res) => { requests.push(`${req.method} ${req.url}`); res.setHeader('content-type', 'application/json'); if (req.url?.startsWith('/api/v1/workflows?')) res.end(JSON.stringify({ data: [{ id: 'wf-1' }], nextCursor: null })); else res.end(JSON.stringify(current())); }).listen(0, '127.0.0.1');
  await once(api, 'listening'); const address = api.address(); if (!address || typeof address === 'string') throw new Error('address');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-connected-e2e-'));
  const artifactPath = path.join(temp, 'workflow.json'); fs.writeFileSync(artifactPath, JSON.stringify(current()));
  const claim: Claim = { id: 'declared-send', subject: 'agent:n8n:wf-1:agent', predicate: 'CAN', action: 'SEND', resource: 'email:outbound', resourceDescriptor: { namespace: 'workflow', version: '0', type: 'email', scope: 'outbound', artifact: '@n8n/n8n-nodes-langchain.gmailTool' }, source: 'DECLARATION', status: 'DECLARED', provenance: [{ sourceType: 'DECLARATION', artifact: 'taidyup.json' }] };
  const config = { provider: 'n8n' as const, baseUrl, token: 'synthetic-token', connectionId: 'disposable-instance', authorityMode: 'CLIENT_ENFORCED_READ_ONLY' as const, allowLoopbackHttp: true };
  try {
    const t1 = await analyzeConnectedN8nWorkflow({ config, workflowId: 'wf-1', observedArtifactPath: artifactPath, declaredClaims: [claim] });
    assert.equal(t1.reconciliation.reconciledClaims.find(item => item.id === claim.id)?.status, 'SUPPORTED');
    assert.equal(t1.evidences.some(item => item.data?.capability === 'SEND'), true);
    assert.equal(t1.evidences.some(item => item.data?.capability === 'EXECUTE'), false, 'disconnected tool must not bind');
    state.includeGmail = false; state.revision++;
    const t2 = await analyzeConnectedN8nWorkflow({ config, workflowId: 'wf-1', observedArtifactPath: artifactPath, previousConnectedEvidences: t1.evidences, declaredClaims: [claim] });
    const reconciled = t2.reconciliation.reconciledClaims.find(item => item.id === claim.id);
    assert.equal(reconciled?.status, 'UNVERIFIED');
    assert.ok(reconciled?.assessment?.diagnostics.includes('CURRENT_STATE_DRIFT'));
    assert.ok(t2.absenceEvidences.some(item => item.data?.capability === 'SEND'));
    assert.equal(requests.every(item => item.startsWith('GET ')), true);
    console.log('CONNECTED n8n E2E: declared + observed + T1/T2 configured drift PASS');
  } finally { api.close(); await once(api, 'close'); fs.rmSync(temp, { recursive: true, force: true }); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
