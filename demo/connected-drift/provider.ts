import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const workflows = {
  t1: JSON.parse(fs.readFileSync(path.join(directory, 'workflow-t1.json'), 'utf8')),
  t2: JSON.parse(fs.readFileSync(path.join(directory, 'workflow-t2.json'), 'utf8'))
};
const port = Number(process.env.TAIDYUP_DEMO_N8N_PORT || 5679);
const expectedToken = 'synthetic-demo-token';
let state: keyof typeof workflows = 't1';

const server = http.createServer((request, response) => {
  response.setHeader('content-type', 'application/json');
  if (request.method !== 'GET') {
    response.statusCode = 405;
    return response.end(JSON.stringify({ error: 'SYNTHETIC_DEMO_GET_ONLY' }));
  }
  if (request.headers['x-n8n-api-key'] !== expectedToken) {
    response.statusCode = 401;
    return response.end(JSON.stringify({ error: 'SYNTHETIC_DEMO_TOKEN_REQUIRED' }));
  }
  if (request.url?.startsWith('/api/v1/workflows?')) {
    return response.end(JSON.stringify({ data: [{ id: 'wf-1', versionId: workflows[state].versionId }], nextCursor: null }));
  }
  if (request.url?.startsWith('/api/v1/workflows/wf-1?') || request.url === '/api/v1/workflows/wf-1') return response.end(JSON.stringify(workflows[state]));
  response.statusCode = 404;
  return response.end(JSON.stringify({ error: 'SYNTHETIC_DEMO_ROUTE_NOT_FOUND' }));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`SYNTHETIC DEMO n8n-compatible source: http://127.0.0.1:${port}`);
  console.log('State: T1 — Gmail SEND present. Type t2 + Enter to remove it; t1 to restore; quit to stop.');
});

const input = readline.createInterface({ input: process.stdin, output: process.stdout });
input.on('line', command => {
  const normalized = command.trim().toLowerCase();
  if (normalized === 't1' || normalized === 't2') {
    state = normalized;
    console.log(`State: ${state.toUpperCase()} — Gmail SEND ${state === 't1' ? 'present' : 'absent'}.`);
  } else if (normalized === 'status') console.log(`State: ${state.toUpperCase()}.`);
  else if (normalized === 'quit') server.close(() => process.exit(0));
  else console.log('Commands: t1, t2, status, quit');
});
