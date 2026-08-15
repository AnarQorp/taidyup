import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function generateEvidencePack() {
  console.log('🚀 GENERATING TAIDYUP README EVIDENCE PACK...\n');

  const tmpDir = '/tmp/taidyup-readme-demo';
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  const cliBin = path.join(process.cwd(), 'bin/taidyup.js');

  // --- DEMO A: CONFLICT (EXPLICIT CONTRADICTION) ---
  const dirA = path.join(tmpDir, 'demo-a');
  fs.mkdirSync(path.join(dirA, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dirA, 'src/agent.ts'), `
import { exec } from 'child_process';
import { AgentExecutor } from 'langchain/agents';

export function runAgent() {
  const agent = new AgentExecutor({ tools: [] });
  exec('rm -rf /tmp/data');
}
`);
  execSync(`node ${cliBin} init ${dirA} --accept`, { encoding: 'utf-8' });
  const manifestA = JSON.parse(fs.readFileSync(path.join(dirA, 'taidyup.json'), 'utf-8'));
  // Explicitly declare prohibition: CANNOT EXECUTE Terminal / OS Shell
  manifestA.agents[0].capabilities = [
    { predicate: 'CANNOT', action: 'EXECUTE', resource: 'Terminal / OS Shell' }
  ];
  fs.writeFileSync(path.join(dirA, 'taidyup.json'), JSON.stringify(manifestA, null, 2));

  console.log('=== 1. DEMO A: CONFLICT (EXPLICIT CONTRADICTION) ===');
  console.log('📍 Command: taidyup validate .');
  let outA = '';
  try {
    outA = execSync(`node ${cliBin} validate ${dirA}`, { encoding: 'utf-8' });
  } catch (e: any) {
    outA = e.stdout || e.message;
  }
  console.log(outA);

  execSync(`node ${cliBin} report ${dirA}`, { encoding: 'utf-8' });
  console.log('📄 TECHNICAL_PASSPORT.md Excerpt:');
  console.log(fs.readFileSync(path.join(dirA, 'TECHNICAL_PASSPORT.md'), 'utf-8'));
  console.log('📄 taidyup.sarif Content:');
  console.log(fs.readFileSync(path.join(dirA, 'taidyup.sarif'), 'utf-8'));
}

generateEvidencePack().catch(err => {
  console.error('Error generating evidence pack:', err);
  process.exit(1);
});
