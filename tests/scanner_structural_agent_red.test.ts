import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ScannerCore } from '../src/scanner/scannerCore.js';

function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-structural-agent-red-'));
  fs.writeFileSync(path.join(root, 'pyproject.toml'), '[project]\nname = "structural-coding-system"\ndependencies = ["anthropic"]\n');
  fs.mkdirSync(path.join(root, 'src'));
  return root;
}

function write(root: string, relative: string, content: string): void {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const workerSource = `
class CodeWorker(BaseWorker):
    def __init__(self, model):
        self.model = model

    def initialize(self, prompt):
        return self.model.complete(prompt)

    def improve(self, selected_files, prompt):
        return self.model.complete(prompt, context=selected_files)
`;

async function structuralAgentDetection(): Promise<void> {
  const root = fixture();
  try {
    write(root, 'src/worker.py', workerSource);
    write(root, 'src/main.py', 'worker = CodeWorker(model=llm)\nresult = worker.initialize(user_prompt)\n');
    const scan = await ScannerCore.scanRepository(root);
    assert.equal(scan.assets[0].primaryAssetType, 'AGENT');
    assert.equal(scan.summary.agentCount, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function agentBoundRead(): Promise<void> {
  const root = fixture();
  try {
    write(root, 'src/worker.py', workerSource);
    write(root, 'src/main.py', `
worker = CodeWorker(model=llm)
selected = project_repository.read_selected_files()
result = worker.improve(selected, user_prompt)
`);
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    const claim = asset.capabilities.find(item => item.action === 'READ');
    assert.ok(claim, 'selected project files passed into an agent method should produce a READ observation');
    assert.equal(claim.evidenceStrength, 'AGENT_BOUND');
    assert.equal(claim.provenance.file, 'src/main.py');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function agentOutputBoundWrite(): Promise<void> {
  const root = fixture();
  try {
    write(root, 'src/worker.py', workerSource);
    write(root, 'src/main.py', `
worker = CodeWorker(model=llm)
generated_files = worker.initialize(user_prompt)
project_repository.write_files(generated_files)
`);
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    const claim = asset.capabilities.find(item => item.action === 'WRITE');
    assert.ok(claim, 'writing the direct result of an agent method should produce a WRITE observation');
    assert.equal(claim.evidenceStrength, 'AGENT_BOUND');
    assert.equal(claim.provenance.file, 'src/main.py');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function gatedGeneratedEntrypointExecution(): Promise<void> {
  const root = fixture();
  try {
    write(root, 'src/worker.py', workerSource);
    write(root, 'src/main.py', `
worker = CodeWorker(model=llm)
generated_files = worker.initialize(user_prompt)
if confirm("Execute the generated entrypoint?"):
    execution_environment.upload(generated_files).run("bash entrypoint.sh")
`);
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    const claim = asset.capabilities.find(item => item.action === 'EXECUTE');
    assert.ok(claim, 'execution consuming agent output should produce an EXECUTE observation');
    assert.equal(claim.evidenceStrength, 'AGENT_BOUND');
    assert.equal(claim.provenance.file, 'src/main.py');
    assert.notEqual(claim.constraint, 'approval_required=true', 'a lexical confirmation prompt alone must not verify a formal approval policy');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function editorSubprocessRemainsUnbound(): Promise<void> {
  const root = fixture();
  try {
    write(root, 'src/agent.py', 'const agent = Agent({}); agent.invoke(input);\n');
    write(root, 'src/editor.py', 'import subprocess\nsubprocess.run([editor, selected_file])\n');
    const scan = await ScannerCore.scanRepository(root);
    assert.equal(scan.assets[0].capabilities.some(item => item.action === 'EXECUTE'), false);
    assert.equal(scan.potentialFunctionalitiesNotBound.some(item => item.file === 'src/editor.py'), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function classNameAloneIsNotAgent(): Promise<void> {
  const root = fixture();
  try {
    write(root, 'src/labels.py', 'class SomethingAgent:\n    pass\n');
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    assert.notEqual(asset.primaryAssetType, 'AGENT');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function unrelatedShellAndAgentRemainUnbound(): Promise<void> {
  const root = fixture();
  try {
    write(root, 'src/agent.ts', 'const agent = Agent({}); agent.invoke(input);\n');
    write(root, 'src/maintenance.ts', "import { exec } from 'child_process';\nexec('rotate-logs');\n");
    const scan = await ScannerCore.scanRepository(root);
    assert.equal(scan.assets[0].capabilities.some(item => item.action === 'EXECUTE'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function unrelatedConfirmationIsNotGatedExecute(): Promise<void> {
  const root = fixture();
  try {
    write(root, 'src/agent.ts', 'const agent = Agent({}); agent.invoke(input);\n');
    write(root, 'src/preferences.ts', 'if (confirm("Save theme?")) saveTheme();\n');
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    assert.equal(asset.capabilities.some(item => item.action === 'EXECUTE'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function filesystemReaderWithoutAgentFlowIsNotBound(): Promise<void> {
  const root = fixture();
  try {
    write(root, 'src/worker.py', workerSource);
    write(root, 'src/reader.py', 'selected = project_repository.read_selected_files()\nprint(len(selected))\n');
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    assert.equal(asset.capabilities.some(item => item.action === 'READ'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function independentWriterDoesNotBindAgentOutput(): Promise<void> {
  const root = fixture();
  try {
    write(root, 'src/worker.py', workerSource);
    write(root, 'src/main.py', `
worker = CodeWorker(model=llm)
generated_files = worker.initialize(user_prompt)
project_repository.write_files(unrelated_template)
`);
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    assert.equal(asset.capabilities.some(item => item.action === 'WRITE'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function independentArtifactDoesNotBindExecution(): Promise<void> {
  const root = fixture();
  try {
    write(root, 'src/worker.py', workerSource);
    write(root, 'src/main.py', `
worker = CodeWorker(model=llm)
generated_files = worker.initialize(user_prompt)
execution_environment.upload(release_bundle).run("deploy")
`);
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    assert.equal(asset.capabilities.some(item => item.action === 'EXECUTE'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function sameVariableNameAcrossFunctionsDoesNotBind(): Promise<void> {
  const root = fixture();
  try {
    write(root, 'src/worker.py', workerSource);
    write(root, 'src/main.py', `
worker = CodeWorker(model=llm)

def generate():
    files = worker.initialize(user_prompt)
    return files

def deploy_unrelated():
    files = release_repository.load_release()
    execution_environment.upload(files).run("deploy")

generate()
`);
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    assert.equal(asset.capabilities.some(item => item.action === 'EXECUTE'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const cases: Array<[string, () => Promise<void>]> = [
    ['structural agent detection', structuralAgentDetection],
    ['agent-bound READ', agentBoundRead],
    ['agent-output-bound WRITE', agentOutputBoundWrite],
    ['gated generated entrypoint EXECUTE', gatedGeneratedEntrypointExecution],
    ['editor subprocess remains unbound', editorSubprocessRemainsUnbound],
    ['class name alone is not an agent', classNameAloneIsNotAgent],
    ['unrelated shell and agent remain unbound', unrelatedShellAndAgentRemainUnbound],
    ['unrelated confirmation is not gated EXECUTE', unrelatedConfirmationIsNotGatedExecute],
    ['filesystem reader without agent flow is not bound', filesystemReaderWithoutAgentFlowIsNotBound],
    ['independent writer does not bind agent output', independentWriterDoesNotBindAgentOutput],
    ['independent artifact does not bind execution', independentArtifactDoesNotBindExecution],
    ['same variable name across functions does not bind', sameVariableNameAcrossFunctionsDoesNotBind],
  ];
  const failures: string[] = [];
  for (const [name, run] of cases) {
    try {
      await run();
      console.log(`  PASS ${name}`);
    } catch (error) {
      failures.push(name);
      console.error(`  FAIL ${name}:`, error);
    }
  }
  assert.deepEqual(failures, [], `Expected RED gaps: ${failures.join(', ')}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
