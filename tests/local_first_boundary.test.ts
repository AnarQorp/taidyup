import assert from 'assert';
import fs from 'fs';
import path from 'path';

function run() {
  const productFiles = [
    'index.html',
    'src/application/analyzeLocalProject.ts',
    'src/local-ui/server.ts',
    'src/frontend/App.tsx',
    'src/frontend/hooks/useLocalAnalysis.ts',
    'src/frontend/adapters/localAnalysisAdapter.ts',
    'src/frontend/components/AnalysisView.tsx'
  ];
  const source = productFiles.map(file => fs.readFileSync(path.resolve(file), 'utf-8')).join('\n');

  for (const forbiddenImport of ['backend/db', 'sqlite', 'githubConnector', 'connectors/github', 'organizations']) {
    assert.ok(!source.toLowerCase().includes(forbiddenImport.toLowerCase()), `local UI path must not depend on ${forbiddenImport}`);
  }
  assert.ok(!/https?:\/\/(?!127\.0\.0\.1|localhost)/i.test(source), 'local UI path must not contain an external HTTP endpoint');

  const adapter = fs.readFileSync(path.resolve('src/frontend/adapters/localAnalysisAdapter.ts'), 'utf-8');
  assert.match(adapter, /fetch\('\/local-api\/analyze'/, 'browser adapter may call only the same-origin local bridge');
  assert.match(adapter, /fetch\('\/local-api\/connected-n8n'/, 'CONNECTED browser adapter may call only the same-origin local bridge');
  assert.ok(!adapter.includes('http://') && !adapter.includes('https://'), 'browser adapter must not call an absolute network endpoint');
}

try {
  run();
  console.log('✅ Local-first boundary tests passed');
} catch (error) {
  console.error(error);
  process.exit(1);
}
