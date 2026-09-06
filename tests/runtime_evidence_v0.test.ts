import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DeterministicLocalToolWrapper, importRuntimeArtifact, RuntimeArtifactError, validateRuntimeData } from '../src/runtime/runtimeEvidence.js';

function expectCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => error instanceof RuntimeArtifactError && error.code === code);
}

function baseEvent(): any {
  return {
    schemaVersion: '0.1', eventKind: 'EXECUTION_COMPLETED', eventTime: '2026-09-06T08:00:00.000Z',
    operation: { action: 'SEND', resource: 'mail-class' },
    bindings: {
      subject: { state: 'UNBOUND', value: 'claimed-agent' },
      action: { state: 'BOUND', method: 'STRUCTURAL', value: 'SEND', evidence: 'wrapper-dispatch', evidenceRef: 'runtime-wrapper:operation' },
      resource: { state: 'PARTIAL', method: 'SOURCE_ASSERTED', value: 'mail-class', evidence: 'source-label' }, constraints: { state: 'UNBOUND' }
    },
    source: { kind: 'IMPORTED_ARTIFACT', identity: 'fixture.runtime.v0' }, sourceEventId: 'run-1:3',
    observationScope: { kind: 'RUN', id: 'run-1' }, completeness: 'PARTIAL_OBSERVATION',
    sanitization: { policy: 'ALLOWLIST_V0', rawPayloadPersisted: false, droppedFields: ['arguments', 'result', 'exception'] },
    outcome: 'SUCCEEDED', runId: 'run-1'
  };
}

function run(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-runtime-v0-'));
  try {
    assert.equal(validateRuntimeData(baseEvent()).completeness, 'PARTIAL_OBSERVATION');

    for (const field of ['userPrompt', 'systemPrompt', 'prompt', 'modelOutput', 'output', 'email', 'recipient', 'Authorization', 'authorization', 'Bearer', 'token', 'apiKey', 'api_key', 'password', 'secret', 'cookie', 'headers', 'body', 'request', 'response', 'query', 'queryString', 'exception', 'stack', 'fileContent']) {
      expectCode(() => validateRuntimeData({ ...baseEvent(), [field]: 'CANARY' }), 'RUNTIME_UNKNOWN_FIELD');
    }
    for (const mutate of [
      (e: any) => { e.runId = 'Bearer CANARY'; },
      (e: any) => { e.sourceEventId = 'user@example.com'; },
      (e: any) => { e.source.identity = 'https://example.test/x?token=CANARY'; },
      (e: any) => { e.operation.resource = 'user@example.com'; }
    ]) { const event = baseEvent(); mutate(event); expectCode(() => validateRuntimeData(event), 'RUNTIME_SENSITIVE_OR_INVALID_VALUE'); }

    const complete = baseEvent(); complete.completeness = 'COMPLETE_RUN_OBSERVATION';
    expectCode(() => validateRuntimeData(complete), 'RUNTIME_COMPLETENESS_UNSUPPORTED');
    const fakeBound = baseEvent(); fakeBound.bindings.subject = { state: 'BOUND', method: 'STRUCTURAL', value: 'agent' };
    expectCode(() => validateRuntimeData(fakeBound), 'RUNTIME_BINDING_PROOF_REQUIRED');
    const unknown = baseEvent(); unknown.operation.rawArguments = { secret: 'CANARY' };
    expectCode(() => validateRuntimeData(unknown), 'RUNTIME_UNKNOWN_FIELD');

    const artifact = path.join(root, 'runtime.jsonl'); let id = 0;
    const wrapper = new DeterministicLocalToolWrapper(artifact, 'fixture.wrapper', () => '2026-09-06T08:00:00.000Z', () => `execution-${++id}`);
    assert.equal(wrapper.invoke({ subject: 'Agent X', action: 'SEND', resource: 'mail-class', runId: 'external-run' }, () => 42), 42);
    wrapper.invoke({ subject: 'Agent X', action: 'SEND', resource: 'mail-class', runId: 'external-run' }, () => 43);
    const imported = importRuntimeArtifact(artifact);
    assert.equal(imported.evidences.length, 6);
    assert.equal(new Set(imported.evidences.map(e => e.data.runId)).size, 2, 'reused external run IDs must not collide');
    assert(imported.evidences.every(e => e.data.bindings.subject.state === 'UNBOUND'));
    assert(!fs.readFileSync(artifact, 'utf8').includes('42'));

    const boundArtifact = path.join(root, 'bound.jsonl');
    const boundWrapper = new DeterministicLocalToolWrapper(boundArtifact, 'fixture.wrapper', () => '2026-09-06T08:00:00.000Z', () => 'bound-execution');
    boundWrapper.invoke({ action: 'SEND', establishedSubjectBinding: { value: 'agent-1', method: 'STRUCTURAL', evidence: 'manifest-to-component binding', evidenceRef: 'evidence:binding-1' } }, () => true);
    assert(importRuntimeArtifact(boundArtifact).evidences.every(e => e.subject === 'agent-1'));

    const duplicateArtifact = path.join(root, 'duplicate.jsonl'); const line = JSON.stringify(baseEvent());
    fs.writeFileSync(duplicateArtifact, `${line}\n${line}\n`);
    const duplicate = importRuntimeArtifact(duplicateArtifact);
    assert.equal(duplicate.evidences.length, 1); assert.deepEqual(duplicate.diagnostics, ['DUPLICATE_RUNTIME_EVENT']);

    const conflict = baseEvent(); conflict.outcome = 'FAILED';
    fs.writeFileSync(duplicateArtifact, `${line}\n${JSON.stringify(conflict)}\n`);
    expectCode(() => importRuntimeArtifact(duplicateArtifact), 'RUNTIME_EVENT_ID_CONFLICT');

    const badHash = baseEvent(); badHash.eventHash = '0'.repeat(64);
    expectCode(() => validateRuntimeData(badHash), 'RUNTIME_EVENT_HASH_MISMATCH');
    const malformed = path.join(root, 'malformed.jsonl'); fs.writeFileSync(malformed, '{broken\n');
    expectCode(() => importRuntimeArtifact(malformed), 'RUNTIME_JSONL_INVALID');
    const unsupported = baseEvent(); unsupported.schemaVersion = '9.9';
    expectCode(() => validateRuntimeData(unsupported), 'RUNTIME_SCHEMA_UNSUPPORTED');
    const unknownKind = baseEvent(); unknownKind.eventKind = 'EXECUTED';
    expectCode(() => validateRuntimeData(unknownKind), 'RUNTIME_EVENT_KIND_UNKNOWN');
    const oversizedLine = path.join(root, 'oversized-line.jsonl'); fs.writeFileSync(oversizedLine, `${'x'.repeat(16 * 1024 + 1)}\n`);
    expectCode(() => importRuntimeArtifact(oversizedLine), 'RUNTIME_EVENT_TOO_LARGE');
    const oversizedArtifact = path.join(root, 'oversized-artifact.jsonl'); fs.writeFileSync(oversizedArtifact, Buffer.alloc(2 * 1024 * 1024 + 1));
    expectCode(() => importRuntimeArtifact(oversizedArtifact), 'RUNTIME_ARTIFACT_TOO_LARGE');
    const tooMany = path.join(root, 'too-many.jsonl'); fs.writeFileSync(tooMany, `${line}\n`.repeat(2_001));
    expectCode(() => importRuntimeArtifact(tooMany), 'RUNTIME_ARTIFACT_TOO_MANY_EVENTS');
    console.log('Runtime Evidence V0: PASS (strict schema, privacy, binding, completeness, identity)');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

run();
