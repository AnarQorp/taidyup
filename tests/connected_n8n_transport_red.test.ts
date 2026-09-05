import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { N8nConnectedClient, ConnectedTransportError } from '../src/connected/n8n/n8nConnectedClient.js';

const workflow = (overrides: Record<string, unknown> = {}) => ({
  id: 'wf-1', name: 'Connected agent', active: true, versionId: 'draft-2', activeVersionId: 'active-1', updatedAt: '2026-09-05T10:00:00Z',
  nodes: [
    { id: 'agent', name: 'Agent', type: '@n8n/n8n-nodes-langchain.agent', typeVersion: 2, parameters: {} },
    { id: 'gmail', name: 'Mail', type: '@n8n/n8n-nodes-langchain.gmailTool', typeVersion: 2, parameters: { operation: 'send', recipient: 'person@example.test', authorization: 'Bearer SECRET' }, credentials: { gmailOAuth2: { id: 'cred-secret', name: 'Private credential' } } },
    { id: 'unknown', name: 'Community', type: 'community.unknownTool', typeVersion: 1, parameters: { apiKey: 'SECRET-KEY' } }
  ],
  connections: { Mail: { ai_tool: [[{ node: 'Agent', type: 'ai_tool', index: 0 }]] } },
  pinData: { Agent: [{ private: 'PINNED-CUSTOMER-DATA' }] }, executionData: { secret: 'RUNTIME-PAYLOAD' }, ...overrides
});

async function server(handler: http.RequestListener): Promise<{ origin: string; close(): Promise<void> }> {
  const instance = http.createServer(handler).listen(0, '127.0.0.1');
  await once(instance, 'listening');
  const address = instance.address(); if (!address || typeof address === 'string') throw new Error('missing address');
  return { origin: `http://127.0.0.1:${address.port}`, close: async () => { instance.close(); await once(instance, 'close'); } };
}

const config = (origin: string, overrides: Record<string, unknown> = {}) => ({ provider: 'n8n' as const, baseUrl: origin, token: 'TOP-SECRET-TOKEN', connectionId: 'test-instance', authorityMode: 'CLIENT_ENFORCED_READ_ONLY' as const, allowLoopbackHttp: true, timeoutMs: 500, maxResponseBytes: 100_000, maxPages: 3, ...overrides });

async function main(): Promise<void> {
// A/B/F/G/H/I/K/L/P/Q/R/S/T: exact GET/auth, sanitized output, status failures and unknown fields.
{
  const requests: Array<{ method?: string; url?: string; token?: string }> = [];
  const api = await server((req, res) => {
    requests.push({ method: req.method, url: req.url, token: String(req.headers['x-n8n-api-key']) });
    if (req.url?.startsWith('/api/v1/workflows?')) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data: [{ id: 'wf-1', name: 'Connected agent' }], nextCursor: null })); return; }
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(workflow({ unexpected: { secret: 'DROP-ME' } })));
  });
  const result = await N8nConnectedClient.collect(config(api.origin, { authorityMode: 'TECHNICALLY_READ_ONLY' }), 'wf-1');
  await api.close();
  assert.deepEqual(requests.map(r => r.method), ['GET', 'GET']);
  assert.ok(requests.every(r => r.token === 'TOP-SECRET-TOKEN' && !r.url?.includes('TOP-SECRET')));
  const serialized = JSON.stringify(result);
  for (const secret of ['TOP-SECRET-TOKEN', 'PINNED-CUSTOMER-DATA', 'RUNTIME-PAYLOAD', 'SECRET-KEY', 'Private credential', 'person@example.test', 'Bearer SECRET', 'DROP-ME']) assert.equal(serialized.includes(secret), false);
  assert.equal(result.snapshot.completeness, 'COMPLETE');
  assert.equal(result.evidences.every(e => e.sourceType === 'CONNECTED'), true);
  assert.equal(result.evidences.some(e => e.data?.capability === 'SEND'), true);
  assert.equal(result.artifact.components.some(c => c.kind === 'UNMAPPED'), true);
  assert.equal(result.evidences.some(e => e.sourceType === 'RUNTIME'), false);
  assert.notEqual(result.snapshot.draftRevision, result.snapshot.activeRevision);
  assert.equal(result.snapshot.declaredAuthorityMode, 'TECHNICALLY_READ_ONLY');
  assert.equal(result.snapshot.authorityMode, 'UNKNOWN', 'operator declaration alone must not prove provider-enforced read-only scope');
}

async function expectFailure(status: number, code: string): Promise<void> {
  const api = await server((_req, res) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ message: `failure TOP-SECRET-TOKEN` })); });
  await assert.rejects(() => N8nConnectedClient.collect(config(api.origin), 'wf-1'), (error: ConnectedTransportError) => error.code === code && !error.message.includes('TOP-SECRET'));
  await api.close();
}
await expectFailure(401, 'AUTHENTICATION_FAILED');
await expectFailure(403, 'ACCESS_DENIED');
await expectFailure(404, 'NOT_FOUND_UNRESOLVED');
await expectFailure(429, 'RATE_LIMITED');
await expectFailure(500, 'SOURCE_UNAVAILABLE');

// C: redirects fail closed and never reach the second origin.
{
  let leaked = false;
  const target = await server(req => { leaked = Boolean(req.headers['x-n8n-api-key']); });
  const source = await server((_req, res) => { res.statusCode = 302; res.setHeader('location', `${target.origin}/steal`); res.end(); });
  await assert.rejects(() => N8nConnectedClient.collect(config(source.origin), 'wf-1'), (error: ConnectedTransportError) => error.code === 'REDIRECT_REJECTED');
  await source.close(); await target.close(); assert.equal(leaked, false);
}

// D: timeout produces no snapshot/absence.
{
  const api = await server(() => {});
  await assert.rejects(() => N8nConnectedClient.collect(config(api.origin, { timeoutMs: 30 }), 'wf-1'), (error: ConnectedTransportError) => error.code === 'TIMEOUT');
  await api.close();
}

// E: oversized response is rejected.
{
  const api = await server((_req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data: 'x'.repeat(5000) })); });
  await assert.rejects(() => N8nConnectedClient.collect(config(api.origin, { maxResponseBytes: 1000 }), 'wf-1'), (error: ConnectedTransportError) => error.code === 'RESPONSE_TOO_LARGE');
  await api.close();
}

// F/G: malformed JSON and content type fail closed.
for (const [contentType, body, code] of [['application/json', '{', 'MALFORMED_JSON'], ['text/html', '{}', 'UNEXPECTED_CONTENT_TYPE']] as const) {
  const api = await server((_req, res) => { res.setHeader('content-type', contentType); res.end(body); });
  await assert.rejects(() => N8nConnectedClient.collect(config(api.origin), 'wf-1'), (error: ConnectedTransportError) => error.code === code);
  await api.close();
}

// M/N: complete pagination succeeds; interrupted pagination never becomes complete.
{
  let page = 0;
  const api = await server((req, res) => { res.setHeader('content-type', 'application/json'); if (req.url?.includes('/wf-1?')) return res.end(JSON.stringify(workflow())); page++; if (page === 1) return res.end(JSON.stringify({ data: [], nextCursor: 'two' })); res.end(JSON.stringify({ data: [{ id: 'wf-1' }], nextCursor: null })); });
  const result = await N8nConnectedClient.collect(config(api.origin), 'wf-1'); assert.equal(result.snapshot.completeness, 'COMPLETE'); await api.close();
}
{
  let page = 0;
  const api = await server((_req, res) => { page++; res.setHeader('content-type', 'application/json'); if (page === 1) return res.end(JSON.stringify({ data: [], nextCursor: 'two' })); res.statusCode = 500; res.end('{}'); });
  await assert.rejects(() => N8nConnectedClient.collect(config(api.origin), 'wf-1'), (error: ConnectedTransportError) => error.snapshotCompleteness === 'PARTIAL'); await api.close();
}

// O: a pagination loop/race fails incomplete.
{
  const api = await server((_req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data: [], nextCursor: 'same' })); });
  await assert.rejects(() => N8nConnectedClient.collect(config(api.origin), 'wf-1'), (error: ConnectedTransportError) => error.code === 'INCONSISTENT_PAGINATION'); await api.close();
}
{
  const api = await server((req, res) => { res.setHeader('content-type', 'application/json'); res.end(req.url?.startsWith('/api/v1/workflows?') ? JSON.stringify({ data: [{ id: 'wf-1', versionId: 'before' }], nextCursor: null }) : JSON.stringify(workflow({ versionId: 'after' }))); });
  await assert.rejects(() => N8nConnectedClient.collect(config(api.origin), 'wf-1'), (error: ConnectedTransportError) => error.code === 'INCONSISTENT_SNAPSHOT' && error.snapshotCompleteness === 'PARTIAL'); await api.close();
}

// Transport rejects writes, plaintext non-loopback and token-bearing URLs before I/O.
assert.throws(() => N8nConnectedClient.assertMethod('POST'), /forbidden/i);
assert.throws(() => N8nConnectedClient.validateConfig(config('http://example.com')), /HTTPS/);
assert.throws(() => N8nConnectedClient.validateConfig(config('https://user:pass@example.com')), /credentials/i);

console.log('CONNECTED n8n fake HTTP adversarial gate: A-T PASS');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
