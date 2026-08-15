import fs from 'fs';
import path from 'path';

const baseDir = path.join(process.cwd(), 'benchmarks/real_world');

if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir, { recursive: true });
}

const repos = [
  // POSITIVES (15 Agent Repos)
  { id: 'real_langgraph_agent', files: { 'package.json': JSON.stringify({ dependencies: { '@langchain/langgraph': '^0.0.15', '@langchain/openai': '^0.1.0' } }), 'src/agent.ts': 'import { StateGraph } from "@langchain/langgraph";' } },
  { id: 'real_crewai_researcher', files: { 'pyproject.toml': '[tool.poetry.dependencies]\ncrewai = "^0.30.0"\nlangchain-openai = "^0.1.7"', 'main.py': 'from crewai import Agent, Crew, Task' } },
  { id: 'real_mcp_postgres_server', files: { 'package.json': JSON.stringify({ dependencies: { '@modelcontextprotocol/sdk': '^0.5.0', 'pg': '^8.11.0' } }), 'mcp.json': '{"mcpServers":{"pg":{"command":"node"}}}' } },
  { id: 'real_autogen_workflow', files: { 'pyproject.toml': '[tool.poetry.dependencies]\npyautogen = "^0.2.27"', 'src/exec.py': 'import subprocess\nsubprocess.exec("bash")' } },
  { id: 'real_llamaindex_rag', files: { 'requirements.txt': 'llama-index>=0.10.0\nllama-index-llms-mistralai>=0.1.0', 'app.py': 'from llama_index.core import VectorStoreIndex' } },
  { id: 'real_semantic_kernel_plugin', files: { 'pyproject.toml': '[tool.poetry.dependencies]\nsemantic-kernel = "^1.1.0"', 'kernel.py': 'import semantic_kernel as sk' } },
  { id: 'real_openai_agents_sdk', files: { 'requirements.txt': 'openai-agents>=0.1.0\nopenai>=1.25.0', 'agent.py': 'from openai_agents import Agent, Runner' } },
  { id: 'real_google_adk_agent', files: { 'package.json': JSON.stringify({ dependencies: { '@google/agent-sdk': '^1.0.0', '@google/generative-ai': '^0.1.0' } }) } },
  { id: 'real_babyagi_task_agent', files: { 'requirements.txt': 'babyagi>=0.1.0\nopenai>=1.0.0', 'babyagi.py': 'import babyagi' } },
  { id: 'real_autogpt_execution', files: { 'requirements.txt': 'autogpt>=0.5.0\nopenai>=1.0.0', 'cli.py': 'import subprocess\nsubprocess.run("ls")' } },
  { id: 'real_n8n_agent_workflow', files: { 'package.json': JSON.stringify({ dependencies: { 'n8n-nodes-langchain': '^1.0.0', 'n8n-workflow': '^1.0.0' } }) } },
  { id: 'real_crewai_multiagent', files: { 'pyproject.toml': '[tool.poetry.dependencies]\ncrewai = "^0.30.0"', 'crew.py': 'from crewai import Crew' } },
  { id: 'real_mcp_github_server', files: { 'package.json': JSON.stringify({ dependencies: { '@modelcontextprotocol/sdk': '^0.5.0' } }), 'mcp.json': '{"mcpServers":{"gh":{"command":"node"}}}' } },
  { id: 'real_langchain_sql_agent', files: { 'package.json': JSON.stringify({ dependencies: { 'langchain': '^0.2.0', 'sqlite3': '^5.1.0' } }) } },
  { id: 'real_custom_ast_agent', files: { 'requirements.txt': 'anthropic>=0.20.0', 'agent.py': 'class CustomAgent:\n    def run(self): pass' } },

  // NEGATIVES & ADVERSARIAL CASES (10 Non-Agent / Spoofing / Edge Cases)
  { id: 'neg_react_frontend', files: { 'package.json': JSON.stringify({ dependencies: { 'react': '^18.2.0', 'react-dom': '^18.2.0' } }) } },
  { id: 'neg_express_api', files: { 'package.json': JSON.stringify({ dependencies: { 'express': '^4.19.0', 'cors': '^2.8.5' } }) } },
  { id: 'neg_embeddings_only', files: { 'requirements.txt': 'openai>=1.25.0', 'embed.py': 'import openai\nclient.embeddings.create(input="hello")' } },
  { id: 'neg_chat_ui_no_autonomy', files: { 'package.json': JSON.stringify({ dependencies: { 'openai': '^4.0.0', 'react': '^18.0.0' } }), 'src/Chat.tsx': 'export function ChatUI(){ return <div>Chat</div>; }' } },
  { id: 'neg_mcp_library_only', files: { 'package.json': JSON.stringify({ devDependencies: { '@modelcontextprotocol/sdk': '^0.5.0' } }), 'src/index.js': 'console.log("No MCP Server running");' } },
  { id: 'neg_unused_dependency', files: { 'package.json': JSON.stringify({ dependencies: { 'langchain': '^0.1.0', 'lodash': '^4.17.21' } }), 'src/index.js': 'const _ = require("lodash"); console.log("pure lodash");' } },
  { id: 'neg_test_only_imports', files: { 'package.json': JSON.stringify({ devDependencies: { 'openai': '^4.0.0' } }), 'src/math.js': 'export function add(a,b){ return a+b; }', 'tests/openai.test.js': 'import openai from "openai";' } },
  { id: 'neg_readme_spoofing', files: { 'package.json': JSON.stringify({ dependencies: { 'express': '^4.18.2' } }), 'README.md': '# Built with LangGraph\nThis is a revolutionary AI agent powered by LangGraph and OpenAI.' } },
  { id: 'neg_stripe_env_only', files: { 'package.json': JSON.stringify({ dependencies: { 'express': '^4.18.2' } }), '.env.example': 'STRIPE_SECRET_KEY=sk_test_1234567890' } },
  { id: 'neg_dead_code_function', files: { 'package.json': JSON.stringify({ dependencies: { 'express': '^4.18.2' } }), 'src/utils.js': '// Unused unexported dead code\nfunction send_email() { return "email"; }' } }
];

for (const repo of repos) {
  const dir = path.join(baseDir, repo.id);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  for (const [filename, content] of Object.entries(repo.files)) {
    const filePath = path.join(dir, filename);
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

console.log('✅ Created 25 Real-World Positive & Negative Benchmark Repositories in benchmarks/real_world/');
