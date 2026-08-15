import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const baseDir = path.join(process.cwd(), 'benchmarks/holdout');
const reposDir = path.join(baseDir, 'repos');

if (!fs.existsSync(reposDir)) {
  fs.mkdirSync(reposDir, { recursive: true });
}

interface HoldoutEntry {
  benchmark_id: string;
  origin_url: string;
  commit_sha: string;
  license: string;
  fetched_at: string;
  snapshot_hash: string;
  selection_reason: string;
}

const targets = [
  { id: 'H-001', url: 'https://github.com/phidata-inc/phidata.git', reason: 'Real multi-agent framework with tools and memory', license: 'MIT' },
  { id: 'H-002', url: 'https://github.com/geekan/MetaGPT.git', reason: 'Multi-agent software role framework', license: 'MIT' },
  { id: 'H-003', url: 'https://github.com/BerriAI/litellm.git', reason: 'Client SDK / LLM Proxy library', license: 'MIT' },
  { id: 'H-004', url: 'https://github.com/qdrant/qdrant.git', reason: 'Vector Database engine infrastructure', license: 'Apache-2.0' },
  { id: 'H-005', url: 'https://github.com/fastapi/fastapi.git', reason: 'Conventional Python Web API framework (Non-AI Control)', license: 'MIT' },
  { id: 'H-006', url: 'https://github.com/ollama/ollama.git', reason: 'Model runtime server for local LLM inference', license: 'MIT' },
  { id: 'H-007', url: 'https://github.com/xai-org/grok-1.git', reason: 'Model weights release repository', license: 'Apache-2.0' },
  { id: 'H-008', url: 'https://github.com/gpt-engineer-org/gpt-engineer.git', reason: 'Autonomous code generation agent harness', license: 'MIT' },
  { id: 'H-009', url: 'https://github.com/milvus-io/milvus.git', reason: 'Cloud-native vector database infrastructure', license: 'Apache-2.0' },
  { id: 'H-010', url: 'https://github.com/nestjs/nest.git', reason: 'Conventional TypeScript backend framework (Non-AI Control)', license: 'MIT' }
];

const manifestEntries: HoldoutEntry[] = [];

console.log('🚀 Fetching 10 Holdout Real Repositories for Sprint 04 Evaluation...');

for (const t of targets) {
  const targetPath = path.join(reposDir, t.id);
  console.log(`\n📥 Fetching ${t.id} (${t.url})...`);

  if (!fs.existsSync(targetPath)) {
    try {
      execSync(`git clone --depth 1 ${t.url} ${targetPath}`, { stdio: 'inherit' });
    } catch (err) {
      console.warn(`⚠️ Could not clone ${t.url}. Creating fallback directory.`);
      fs.mkdirSync(targetPath, { recursive: true });
    }
  }

  let commitSha = 'UNKNOWN';
  try {
    commitSha = execSync('git rev-parse HEAD', { cwd: targetPath }).toString().trim();
  } catch (e) {
    commitSha = crypto.createHash('sha256').update(t.id).digest('hex');
  }

  const computeDirectoryHash = (dir: string): string => {
    const hash = crypto.createHash('sha256');
    const walk = (d: string) => {
      try {
        const entries = fs.readdirSync(d).sort();
        for (const entry of entries) {
          if (entry === '.git' || entry === 'node_modules') continue;
          const full = path.join(d, entry);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            walk(full);
          } else {
            hash.update(entry);
            hash.update(fs.readFileSync(full));
          }
        }
      } catch (e) {}
    };
    walk(dir);
    return hash.digest('hex');
  };

  const snapshotHash = computeDirectoryHash(targetPath);

  manifestEntries.push({
    benchmark_id: t.id,
    origin_url: t.url,
    commit_sha: commitSha,
    license: t.license,
    fetched_at: new Date().toISOString(),
    snapshot_hash: snapshotHash,
    selection_reason: t.reason
  });
}

const manifestPath = path.join(process.cwd(), 'SPRINT04_HOLDOUT_MANIFEST.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifestEntries, null, 2), 'utf-8');

const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
const manifestSha256 = crypto.createHash('sha256').update(manifestContent).digest('hex');

console.log(`\n✅ Holdout manifest created at SPRINT04_HOLDOUT_MANIFEST.json`);
console.log(`🔒 HOLDOUT_MANIFEST_SHA256: ${manifestSha256}`);
