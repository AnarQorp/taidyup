import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CliCore } from '../src/cli/cliCore.js';
import { ManifestParser } from '../src/trust-kernel/manifestParser.js';

function projectFixture(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-init-accept-'));
}

function writeDraft(root: string, draft: unknown): string {
  const draftPath = path.join(root, 'taidyup.json.draft');
  fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2));
  return draftPath;
}

async function candidateOnlyDraftIsRejected(): Promise<void> {
  const root = projectFixture();
  try {
    const draftPath = writeDraft(root, {
      draftMetadata: { status: 'GENERATED_DRAFT', declarative: false, requiresOwnerReview: true },
      version: '1.0',
      project: 'example',
      agents: [],
      candidateSuggestions: [{
        candidateId: 'candidate-1',
        suggestedAssetType: 'AGENT',
        capabilitySuggestions: [{ action: 'EXECUTE', resource: 'Terminal' }]
      }]
    });
    const before = fs.readFileSync(draftPath, 'utf-8');

    const exitCode = await CliCore.execute({ command: 'init', targetPath: root, accept: true });

    assert.notEqual(exitCode, 0);
    assert.equal(fs.existsSync(path.join(root, 'taidyup.json')), false);
    assert.equal(fs.readFileSync(draftPath, 'utf-8'), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function reviewedDeclarationIsAcceptedWithoutSuggestions(): Promise<void> {
  const root = projectFixture();
  try {
    writeDraft(root, {
      draftMetadata: { status: 'GENERATED_DRAFT', declarative: false, requiresOwnerReview: false },
      version: '1.0',
      project: 'example',
      agents: [{
        id: 'example-agent',
        name: 'Example Agent',
        purpose: 'Explicit owner-reviewed purpose',
        owner: { name: 'Example Owner', email: 'owner@example.test' },
        capabilities: [{ action: 'READ', resource: 'Repository / Workspace Code' }]
      }],
      candidateSuggestions: [{
        candidateId: 'candidate-1',
        capabilitySuggestions: [{ action: 'EXECUTE', resource: 'Terminal' }]
      }]
    });

    const exitCode = await CliCore.execute({ command: 'init', targetPath: root, accept: true });
    assert.equal(exitCode, 0);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'taidyup.json'), 'utf-8'));
    assert.deepEqual(Object.keys(manifest).sort(), ['agents', 'project', 'version']);
    assert.equal(manifest.agents.length, 1);
    assert.deepEqual(manifest.agents[0].capabilities, [{ action: 'READ', resource: 'Repository / Workspace Code' }]);
    assert.equal(JSON.stringify(manifest).includes('EXECUTE'), false);
    assert.equal(ManifestParser.parseManifest(manifest, 'taidyup.json').isValid, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function missingOwnerIsRejectedAtomically(): Promise<void> {
  const root = projectFixture();
  try {
    const draftPath = writeDraft(root, {
      version: '1.0', project: 'example',
      agents: [{ id: 'agent', name: 'Agent', purpose: 'Reviewed purpose', capabilities: [] }]
    });
    const before = fs.readFileSync(draftPath, 'utf-8');
    assert.notEqual(await CliCore.execute({ command: 'init', targetPath: root, accept: true }), 0);
    assert.equal(fs.existsSync(path.join(root, 'taidyup.json')), false);
    assert.equal(fs.readFileSync(draftPath, 'utf-8'), before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

async function invalidDeclarationIsRejectedAtomically(): Promise<void> {
  const root = projectFixture();
  try {
    const draftPath = writeDraft(root, {
      version: '1.0', project: 'example',
      agents: [{
        id: 'agent', name: 'Agent', purpose: 'Reviewed purpose',
        owner: { name: 'Owner', email: 'owner@example.test' },
        capabilities: [{ action: 'LAUNCH_MISSILES', resource: 'unknown' }]
      }]
    });
    const before = fs.readFileSync(draftPath, 'utf-8');
    assert.notEqual(await CliCore.execute({ command: 'init', targetPath: root, accept: true }), 0);
    assert.equal(fs.existsSync(path.join(root, 'taidyup.json')), false);
    assert.equal(fs.readFileSync(draftPath, 'utf-8'), before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

async function malformedDraftIsRejectedAtomically(): Promise<void> {
  const root = projectFixture();
  try {
    const draftPath = path.join(root, 'taidyup.json.draft');
    const before = '{ not valid JSON';
    fs.writeFileSync(draftPath, before);
    assert.notEqual(await CliCore.execute({ command: 'init', targetPath: root, accept: true }), 0);
    assert.equal(fs.existsSync(path.join(root, 'taidyup.json')), false);
    assert.equal(fs.readFileSync(draftPath, 'utf-8'), before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

async function existingManifestIsNeverOverwritten(): Promise<void> {
  const root = projectFixture();
  try {
    writeDraft(root, {
      version: '1.0', project: 'replacement',
      agents: [{
        id: 'new', name: 'New', purpose: 'New purpose',
        owner: { name: 'New Owner', email: 'new@example.test' }, capabilities: []
      }]
    });
    const manifestPath = path.join(root, 'taidyup.json');
    const existing = '{"sentinel":"preserve-me"}\n';
    fs.writeFileSync(manifestPath, existing);
    assert.notEqual(await CliCore.execute({ command: 'init', targetPath: root, accept: true }), 0);
    assert.equal(fs.readFileSync(manifestPath, 'utf-8'), existing);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

async function main(): Promise<void> {
  const regressions: Array<[string, () => Promise<void>]> = [
    ['candidate-only draft is rejected', candidateOnlyDraftIsRejected],
    ['reviewed declaration excludes suggestions', reviewedDeclarationIsAcceptedWithoutSuggestions],
    ['missing owner is rejected atomically', missingOwnerIsRejectedAtomically],
    ['invalid declaration is rejected atomically', invalidDeclarationIsRejectedAtomically],
    ['malformed draft is rejected atomically', malformedDraftIsRejectedAtomically],
    ['existing manifest is never overwritten', existingManifestIsNeverOverwritten],
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
  assert.deepEqual(failures, []);
  console.log('✅ init --accept hardening tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
