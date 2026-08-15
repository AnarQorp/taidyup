import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const baseDir = path.join(process.cwd(), 'benchmarks/external');
const reposDir = path.join(baseDir, 'repos');

if (!fs.existsSync(reposDir)) {
  fs.mkdirSync(reposDir, { recursive: true });
}

interface CorpusEntry {
  benchmark_id: string;
  origin_url: string;
  commit_sha: string;
  license: string;
  fetched_at: string;
  snapshot_hash: string;
  selection_reason: string;
}

const targets = [
  { id: 'RW-001', url: 'https://github.com/langchain-ai/langchain.git', reason: 'Mainstream Python LLM framework & agent executor', license: 'MIT' },
  { id: 'RW-002', url: 'https://github.com/crewAIInc/crewAI.git', reason: 'Dedicated multi-agent orchestration framework', license: 'MIT' },
  { id: 'RW-003', url: 'https://github.com/microsoft/autogen.git', reason: 'Multi-agent conversational & code execution framework', license: 'MIT' },
  { id: 'RW-004', url: 'https://github.com/microsoft/semantic-kernel.git', reason: 'Enterprise AI agent & plugin SDK', license: 'MIT' },
  { id: 'RW-005', url: 'https://github.com/run-llama/llama_index.git', reason: 'Data framework for LLM RAG & data agents', license: 'MIT' },
  { id: 'RW-006', url: 'https://github.com/modelcontextprotocol/servers.git', reason: 'Reference Model Context Protocol servers', license: 'MIT' },
  { id: 'RW-007', url: 'https://github.com/expressjs/express.git', reason: 'Negative control: conventional Node.js web server with zero AI dependencies', license: 'MIT' },
  { id: 'RW-008', url: 'https://github.com/facebook/react.git', reason: 'Negative control: pure client-side UI library', license: 'MIT' },
  { id: 'RW-009', url: 'https://github.com/openai/openai-node.git', reason: 'Ambiguous/SDK control: client library for OpenAI API without autonomous agent logic', license: 'Apache-2.0' },
  { id: 'RW-010', url: 'https://github.com/chroma-core/chroma.git', reason: 'Ambiguous/Infra control: embedding vector database infrastructure', license: 'Apache-2.0' },
  { id: 'RW-011', url: 'https://github.com/Significant-Gravitas/AutoGPT.git', reason: 'Autonomous goal-driven AI agent harness with shell capabilities', license: 'MIT' },
  { id: 'RW-012', url: 'https://github.com/yoheinakajima/babyagi.git', reason: 'Task-driven autonomous agent script', license: 'MIT' },
  { id: 'RW-013', url: 'https://github.com/vercel/ai.git', reason: 'Ambiguous/UI control: streaming chat UI hooks for Next.js, non-autonomous', license: 'Apache-2.0' },
  { id: 'RW-014', url: 'https://github.com/n8n-io/n8n.git', reason: 'Workflow automation engine with LangChain nodes', license: 'Sustainable Use License' },
  { id: 'RW-015', url: 'https://github.com/ollama/ollama-js.git', reason: 'Ambiguous/SDK control: JavaScript library for local model inference', license: 'MIT' }
];

const manifestEntries: CorpusEntry[] = [];

console.log('🚀 Fetching 15 External Real-World Repositories from GitHub...');

for (const t of targets) {
  const targetPath = path.join(reposDir, t.id);
  console.log(`\n📥 Fetching ${t.id} (${t.url})...`);

  if (!fs.existsSync(targetPath)) {
    try {
      execSync(`git clone --depth 1 ${t.url} ${targetPath}`, { stdio: 'inherit' });
    } catch (err) {
      console.warn(`⚠️ Warning: Could not clone ${t.url}. Creating fallback directory.`);
      fs.mkdirSync(targetPath, { recursive: true });
    }
  }

  let commitSha = 'UNKNOWN';
  try {
    commitSha = execSync('git rev-parse HEAD', { cwd: targetPath }).toString().trim();
  } catch (e) {
    commitSha = crypto.createHash('sha256').update(t.id).digest('hex');
  }

  // Compute snapshot hash over files (exclude .git)
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

const manifestPath = path.join(baseDir, 'corpus-manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifestEntries, null, 2), 'utf-8');

const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
const manifestSha256 = crypto.createHash('sha256').update(manifestContent).digest('hex');

console.log(`\n✅ Corpus manifest created at benchmarks/external/corpus-manifest.json`);
console.log(`🔒 CORPUS_MANIFEST_SHA256: ${manifestSha256}`);
