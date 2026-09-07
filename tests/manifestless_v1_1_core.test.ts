import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeLocalProject, ProjectAnalysisError } from '../src/application/analyzeLocalProject.js';
import { ReportGenerator } from '../src/trust-kernel/reportGenerator.js';
import { SarifExporter } from '../src/cli/sarifExporter.js';
import { DiffEngine } from '../src/cli/diffEngine.js';
import { CliCore } from '../src/cli/cliCore.js';

const worker = `class CodeWorker(BaseWorker):
    def __init__(self, model):
        self.model = model
    def initialize(self, prompt):
        return self.model.complete(prompt)
`;

function project(root: string, name: string, observable = false): string {
  const dir = path.join(root, name); fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name }));
  if (observable) {
    fs.writeFileSync(path.join(dir, 'src', 'worker.py'), worker);
    fs.writeFileSync(path.join(dir, 'src', 'main.py'), 'worker = CodeWorker(model=llm)\ngenerated = worker.initialize(prompt)\nexecution_environment.upload(generated).run("entrypoint")\n');
  }
  return dir;
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-manifestless-'));
  try {
    const observed = await analyzeLocalProject(project(root, 'package-name', true));
    assert.deepEqual(observed.manifest, { status: 'ABSENT', path: null });
    assert.deepEqual(observed.reconciliation.declarationContext, { status: 'ABSENT', path: null });
    assert.equal(observed.project.name, 'package-name');
    assert.equal(observed.declaredClaims.length, 0);
    assert.equal(observed.evidence.some(item => item.sourceType === 'DECLARATION'), false);
    assert.equal(observed.reconciliation.reconciledClaims.some(item => item.action === 'EXECUTE' && item.status === 'UNDECLARED_OBSERVATION'), true);

    const emptyDir = project(root, 'empty');
    fs.writeFileSync(path.join(emptyDir, 'package.json'), '{ invalid convenience metadata');
    const empty = await analyzeLocalProject(emptyDir);
    assert.equal(empty.project.name, 'empty');
    assert.equal(empty.manifest.status, 'ABSENT');
    assert.equal(empty.reconciliation.reconciledClaims.length, 0);

    const malformed = project(root, 'malformed');
    fs.writeFileSync(path.join(malformed, 'taidyup.json'), '{');
    await assert.rejects(() => analyzeLocalProject(malformed), (error: unknown) => error instanceof ProjectAnalysisError && error.code === 'MANIFEST_INVALID_JSON');

    const schemaInvalid = project(root, 'schema-invalid');
    fs.writeFileSync(path.join(schemaInvalid, 'taidyup.json'), JSON.stringify({ version: '1.0', project: 'x', agents: [] }));
    await assert.rejects(() => analyzeLocalProject(schemaInvalid), (error: unknown) => error instanceof ProjectAnalysisError && error.code === 'MANIFEST_SCHEMA_INVALID');

    await assert.rejects(() => analyzeLocalProject(path.join(root, 'missing')), (error: unknown) => error instanceof ProjectAnalysisError && error.code === 'TARGET_NOT_FOUND');
    const file = path.join(root, 'file'); fs.writeFileSync(file, 'x');
    await assert.rejects(() => analyzeLocalProject(file), (error: unknown) => error instanceof ProjectAnalysisError && error.code === 'TARGET_NOT_DIRECTORY');

    const unreadable = project(root, 'unreadable');
    fs.symlinkSync(path.join(unreadable, 'missing-target'), path.join(unreadable, 'src', 'unreadable.py'));
    await assert.rejects(() => analyzeLocalProject(unreadable), (error: unknown) => error instanceof ProjectAnalysisError && error.code === 'TARGET_READ_FAILED');

    const report = ReportGenerator.generateMarkdownReport(observed.project.name, observed.reconciliation);
    assert.match(report, /Declaration source.*ABSENT/);
    assert.match(report, /not intended or authorized capabilities/);
    const sarif = SarifExporter.exportToSarif(observed.project.name, observed.reconciliation);
    assert.equal(sarif.runs[0].properties.declarationContext.status, 'ABSENT');
    assert.doesNotMatch(JSON.stringify(sarif), /unauthorized/i);
    const present = { ...empty.reconciliation, declarationContext: { status: 'PRESENT' as const, path: '/tmp/taidyup.json' } };
    const diff = DiffEngine.computeDiff(empty.reconciliation, present);
    assert.deepEqual(diff.declarationContextChange, { from: 'ABSENT', to: 'PRESENT' });
    assert.match(diff.summaryText, /DECLARATION CONTEXT.*ABSENT -> PRESENT/);
    assert.doesNotMatch(diff.summaryText, /authority change/i);

    const logs: string[] = []; const old = console.log; console.log = (...args: unknown[]) => logs.push(args.join(' '));
    try { assert.equal(await CliCore.execute({ command: 'validate', targetPath: emptyDir }), 0); } finally { console.log = old; }
    assert.match(logs.join('\n'), /Declaration source: ABSENT/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

main().then(() => console.log('✅ Manifestless V1.1 core tests passed')).catch(error => { console.error(error); process.exit(1); });
