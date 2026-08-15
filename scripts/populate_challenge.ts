import fs from 'fs';
import path from 'path';

const baseDir = path.join(process.cwd(), 'benchmarks/unknown_challenge');

if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir, { recursive: true });
}

const challengeRepos = [
  {
    id: 'challenge_repo_1_langchain_tavily',
    files: {
      'package.json': JSON.stringify({ dependencies: { '@langchain/core': '^0.2.0', '@langchain/openai': '^0.1.0', 'tavily': '^0.0.8' } }),
      'src/agent.ts': 'import { AgentExecutor } from "langchain/agents";'
    }
  },
  {
    id: 'challenge_repo_2_crewai_ollama',
    files: {
      'pyproject.toml': '[tool.poetry.dependencies]\ncrewai = "^0.30.0"\nollama = "^0.1.7"',
      'main.py': 'from crewai import Agent, Crew'
    }
  },
  {
    id: 'challenge_repo_3_semantic_kernel_azure',
    files: {
      'pyproject.toml': '[tool.poetry.dependencies]\nsemantic-kernel = "^1.1.0"\nazure-openai = "^1.0.0"',
      'agent.py': 'import semantic_kernel as sk'
    }
  }
];

for (const repo of challengeRepos) {
  const dir = path.join(baseDir, repo.id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  for (const [filename, content] of Object.entries(repo.files)) {
    const filePath = path.join(dir, filename);
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

console.log('✅ Created 3 Unknown Repository Challenge Repositories in benchmarks/unknown_challenge/');
