import assert from 'assert';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { createLocalUiApp } from '../src/local-ui/server.js';

function postJson(port: number, body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/local-api/analyze',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        origin: `http://127.0.0.1:${port}`
      }
    }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        body: JSON.parse(Buffer.concat(chunks).toString('utf-8'))
      }));
    });
    request.on('error', reject);
    request.end(payload);
  });
}

async function run() {
  const app = createLocalUiApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-local-ui-'));

  try {
    const remote = await postJson(port, { targetPath: 'https://github.com/example/repo.git' });
    assert.strictEqual(remote.status, 400);
    assert.strictEqual(remote.body.error.code, 'REMOTE_TARGET_NOT_SUPPORTED');

    fs.mkdirSync(path.join(tempRoot, 'src'));
    fs.writeFileSync(path.join(tempRoot, 'taidyup.json'), JSON.stringify({
      version: '1.0',
      project: 'local-ui-fixture',
      agents: [{
        id: 'main-agent', name: 'Main Agent', purpose: 'Local UI test',
        owner: { name: 'Fixture Owner', email: 'fixture@example.test' },
        capabilities: [{ action: 'READ', resource: 'local:data' }]
      }]
    }));
    fs.writeFileSync(path.join(tempRoot, 'src', 'agent.ts'), 'export const agent = {};\n');

    const analyzed = await postJson(port, { targetPath: tempRoot });
    assert.strictEqual(analyzed.status, 200);
    assert.strictEqual(analyzed.body.project.targetPath, tempRoot);
    assert.strictEqual(analyzed.body.manifest.status, 'DECLARED');
    assert.ok(analyzed.body.reconciliation);
    assert.ok(Array.isArray(analyzed.body.evidence));
    assert.strictEqual('organization' in analyzed.body, false);
    assert.strictEqual('connectors' in analyzed.body, false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

run()
  .then(() => console.log('✅ Local UI bridge tests passed'))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
