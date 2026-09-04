import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ScannerCore } from '../src/scanner/scannerCore.js';
import { CliCore } from '../src/cli/cliCore.js';

function projectFixture(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-scanner-hygiene-'));
}

async function scopeHygiene(): Promise<void> {
  const root = projectFixture();
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'plain-root' }));
    const benchmark = path.join(root, 'tests', 'benchmark_corpus', 'nested-project');
    fs.mkdirSync(benchmark, { recursive: true });
    fs.writeFileSync(path.join(benchmark, 'pyproject.toml'), 'semantic-kernel = "^1.1.0"\nmistralai = "^1.0.0"\n');
    fs.writeFileSync(path.join(benchmark, 'package.json'), JSON.stringify({ dependencies: { '@langchain/openai': '^0.1.0' } }));

    const scan = await ScannerCore.scanRepository(root);
    const asset = scan.assets[0];
    assert.notEqual(asset.framework, 'Semantic Kernel');
    assert.notEqual(asset.provider, 'Mistral');
    assert.notEqual(asset.model, 'gpt-4o');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function exactTechnologyProvenance(): Promise<void> {
  const root = projectFixture();
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { '@langchain/openai': '^0.1.0' } }));
    fs.writeFileSync(path.join(root, 'pyproject.toml'), 'semantic-kernel = "^1.1.0"\n');
    fs.writeFileSync(path.join(root, 'unrelated.txt'), 'mistralai');

    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    assert.equal(asset.frameworkEvidence?.file, 'pyproject.toml');
    assert.equal(asset.providerEvidence?.file, 'package.json');
    assert.equal(asset.modelEvidence?.file, 'package.json');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function noDefaultReadClaim(): Promise<void> {
  const root = projectFixture();
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'minimal-project' }));
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    assert.equal(asset.primaryAssetType, 'UNKNOWN');
    assert.equal(asset.provenance.confidence, 0);
    assert.equal(asset.capabilities.some((claim) => claim.action === 'READ'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function documentationDoesNotCreateExecute(): Promise<void> {
  const root = projectFixture();
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'documented-agent' }));
    fs.writeFileSync(path.join(root, 'README.md'), "import { exec } from 'child_process';\nexec('dangerous example');\n");
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'agent.ts'), 'const graph = new StateGraph({}); graph.invoke({});\n');
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    assert.equal(asset.capabilities.some((claim) => claim.action === 'EXECUTE'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function detectorDoesNotMatchItsOwnPatternLiterals(): Promise<void> {
  const root = projectFixture();
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'detector-tool' }));
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(
      path.join(root, 'src', 'detector.ts'),
      "const constructionPatterns = ['StateGraph', 'AgentExecutor', 'Kernel('];\nconst loopPatterns = ['.run(', '.invoke('];\n",
    );
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    assert.notEqual(asset.primaryAssetType, 'AGENT');
    assert.equal(asset.provenance.positiveSignals.some((signal) => signal.startsWith('AGENT_')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function databaseRunIsNotAnAgentLoop(): Promise<void> {
  const root = projectFixture();
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'database-service' }));
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'db.ts'), "await db.run('INSERT INTO records VALUES (?)', [value]);\n");
    const asset = (await ScannerCore.scanRepository(root)).assets[0];
    assert.equal(asset.provenance.positiveSignals.some((signal) => signal.startsWith('AGENT_EXECUTION_LOOP')), false);
    assert.notEqual(asset.primaryAssetType, 'AGENT');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function independentSignalsAreNotBound(): Promise<void> {
  const root = projectFixture();
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'multi-component-project' }));
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(path.join(root, 'src', 'agent.ts'), 'const graph = StateGraph({}); graph.invoke({});\n');
    fs.writeFileSync(path.join(root, 'src', 'shell.ts'), "import { exec } from 'child_process';\nexec('echo utility');\n");
    const scan = await ScannerCore.scanRepository(root);
    const asset = scan.assets[0];
    assert.equal(asset.capabilities.some((claim) => claim.action === 'EXECUTE'), false);
    assert.equal(scan.potentialFunctionalitiesNotBound.some((item) => item.capability === 'EXECUTE' && item.file === 'src/shell.ts'), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function initProducesReviewableJsonWithoutDeclarations(): Promise<void> {
  const root = projectFixture();
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'draft-project' }));
    fs.mkdirSync(path.join(root, 'src'));
    fs.writeFileSync(
      path.join(root, 'src', 'agent.ts'),
      "import { exec } from 'child_process';\nconst graph = StateGraph({}); graph.invoke({}); exec('echo bound');\n",
    );
    const exitCode = await CliCore.execute({ command: 'init', targetPath: root });
    assert.equal(exitCode, 0);
    const draft = JSON.parse(fs.readFileSync(path.join(root, 'taidyup.json.draft'), 'utf-8'));
    assert.equal(draft.draftMetadata.status, 'GENERATED_DRAFT');
    assert.equal(draft.draftMetadata.declarative, false);
    assert.deepEqual(draft.agents, []);
    assert.ok(Array.isArray(draft.candidateSuggestions));
    const capability = draft.candidateSuggestions[0].capabilitySuggestions[0];
    assert.equal(capability.declarationStatus, 'CANDIDATE_SUGGESTION');
    assert.equal(capability.observationStatus, 'INFERRED');
    assert.equal(capability.evidenceStrength, 'AGENT_BOUND');
    assert.equal(capability.provenance.file, 'src/agent.ts');
    assert.equal(JSON.stringify(draft).includes('Developer Name'), false);
    assert.equal(JSON.stringify(draft).includes('dev@company.com'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const regressions: Array<[string, () => Promise<void>]> = [
    ['nested project scope hygiene', scopeHygiene],
    ['exact technology provenance', exactTechnologyProvenance],
    ['no default READ claim', noDefaultReadClaim],
    ['documentation does not create EXECUTE', documentationDoesNotCreateExecute],
    ['detector does not match its own literals', detectorDoesNotMatchItsOwnPatternLiterals],
    ['db.run is not an agent loop', databaseRunIsNotAnAgentLoop],
    ['independent signals are not bound', independentSignalsAreNotBound],
    ['init produces reviewable JSON without declarations', initProducesReviewableJsonWithoutDeclarations],
  ];
  const failures: string[] = [];
  for (const [name, regression] of regressions) {
    try {
      await regression();
      console.log(`  PASS ${name}`);
    } catch (error) {
      failures.push(name);
      console.error(`  FAIL ${name}:`, error);
    }
  }
  assert.deepEqual(failures, [], `Scanner evidence hygiene failures: ${failures.join(', ')}`);
  console.log('✅ Scanner evidence hygiene tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
