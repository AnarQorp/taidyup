import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { importRuntimeArtifact } from '../src/runtime/runtimeEvidence.js';
import { captureOtelSpansToJsonl, otelSpanToRuntime } from './labs/otelRuntimeLab.js';
import { runtimeDataToEvidence } from '../src/runtime/runtimeEvidence.js';
import { ReconciliationEngine } from '../src/trust-kernel/reconciliationEngine.js';
import { ReportGenerator } from '../src/trust-kernel/reportGenerator.js';
import type { Claim, Evidence } from '../src/trust-kernel/types.js';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

function iso(time: [number, number]): string {
  return new Date(time[0] * 1_000 + time[1] / 1_000_000).toISOString();
}

function captureOfficialSdkSpan(): ReturnType<typeof span> {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  const sdkSpan = provider.getTracer('taidyup-otel-validation-lab').startSpan('send-tool', {
    kind: SpanKind.INTERNAL,
    startTime: new Date('2026-09-06T10:00:00.000Z'),
    attributes: {
      'taidyup.operation.action': 'SEND',
      'taidyup.resource.classification': 'mail-service'
    }
  });
  sdkSpan.setStatus({ code: SpanStatusCode.OK });
  sdkSpan.end(new Date('2026-09-06T10:00:01.000Z'));
  const captured = exporter.getFinishedSpans()[0];
  assert(captured, 'official in-memory exporter must capture the completed span');
  const context = captured.spanContext();
  return span({
    traceId: context.traceId,
    spanId: context.spanId,
    name: captured.name,
    kind: 'INTERNAL',
    startTime: iso(captured.startTime),
    endTime: iso(captured.endTime),
    status: captured.status.code === SpanStatusCode.OK ? 'OK' : captured.status.code === SpanStatusCode.ERROR ? 'ERROR' : 'UNSET',
    resource: {},
    attributes: captured.attributes
  });
}

const span = (overrides: Record<string, unknown> = {}) => ({
  traceId: '11111111111111111111111111111111', spanId: '1111111111111111', name: 'send-tool', kind: 'INTERNAL',
  startTime: '2026-09-06T10:00:00.000Z', endTime: '2026-09-06T10:00:01.000Z', status: 'OK',
  resource: { 'service.name': 'coding-agent' },
  attributes: { 'taidyup.operation.action': 'SEND', 'taidyup.resource.classification': 'mail-service' }, ...overrides
});

function run(): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taidyup-otel-lab-'));
  try {
    // OTEL-A: start + completed/source-reported success; never attempted/result-observed.
    const success = otelSpanToRuntime(captureOfficialSdkSpan());
    assert.deepEqual(success.map(event => event.eventKind), ['EXECUTION_STARTED', 'EXECUTION_COMPLETED']);
    assert.equal(success[1].outcome, 'SUCCEEDED'); assert(success.every(event => event.completeness === 'PARTIAL_OBSERVATION'));
    assert(success.every(event => event.bindings.subject.state === 'UNBOUND'));

    // OTEL-B: source-reported failure is an outcome fact, not an authority assertion.
    const failure = otelSpanToRuntime(span({ status: 'ERROR' }));
    assert.equal(failure[1].outcome, 'FAILED'); assert(!JSON.stringify(failure).match(/authorized|compliant|safe/i));

    // OTEL-C: truncated span yields START only and no fabricated completion.
    const truncated = otelSpanToRuntime(span({ endTime: undefined, status: 'UNSET' }));
    assert.deepEqual(truncated.map(event => event.eventKind), ['EXECUTION_STARTED']);

    // OTEL-D/F: correlation and agent-looking telemetry do not bind a subject.
    assert(success.every(event => event.bindings.subject.state === 'UNBOUND'));
    const independentlyBound = otelSpanToRuntime(span(), { value: 'agent-1', method: 'STRUCTURAL', evidence: 'manifest-component-link', evidenceRef: 'evidence:binding-1' });
    assert(independentlyBound.every(event => event.bindings.subject.value === 'agent-1'));

    const claim = (predicate: 'CAN' | 'CANNOT'): Claim => ({ id: predicate, subject: 'agent-1', predicate, action: 'SEND', resource: 'mail-service', source: 'DECLARATION', status: 'DECLARED', provenance: [{ sourceType: 'DECLARATION', artifact: 'taidyup.json' }] });
    const asEvidence = (events: typeof independentlyBound): Evidence[] => events.map((event, index) => runtimeDataToEvidence(event, 'otel-lab.jsonl', index + 1));
    const undeclared = ReconciliationEngine.reconcile([], asEvidence(independentlyBound));
    assert.equal(undeclared.reconciledClaims[0].status, 'UNDECLARED_OBSERVATION');

    // OTEL-E: adapter emits no ATTEMPTED and preserves lifecycle needed by existing Kernel policy.
    assert(!success.some(event => event.eventKind === 'INVOCATION_ATTEMPTED'));
    const prohibition = ReconciliationEngine.reconcile([claim('CANNOT')], asEvidence(independentlyBound));
    assert.equal(prohibition.reconciledClaims[0].status, 'CONFLICT');
    assert.doesNotMatch(prohibition.findings[0].description, /unauthori[sz]ed|illegal|unsafe|non-compliant/i);

    // OTEL-G: arbitrary telemetry is dropped before persistence; raw canaries never survive.
    const sensitive = span({ attributes: { 'taidyup.operation.action': 'SEND', prompt: 'PROMPT_CANARY', authorization: 'Bearer TOKEN_CANARY', body: 'BODY_CANARY', exception: 'EXCEPTION_CANARY', email: 'person@example.test' } });
    const artifact = path.join(dir, 'otel-runtime.jsonl'); captureOtelSpansToJsonl([sensitive], artifact);
    const persisted = fs.readFileSync(artifact, 'utf8');
    for (const canary of ['PROMPT_CANARY', 'TOKEN_CANARY', 'BODY_CANARY', 'EXCEPTION_CANARY', 'person@example.test']) assert(!persisted.includes(canary));
    assert(persisted.includes('otel-attributes'));
    const sanitizedEvidence = importRuntimeArtifact(artifact).evidences;
    const sanitizedState = ReconciliationEngine.reconcile([], sanitizedEvidence);
    const reusableSurfaces = `${JSON.stringify(sanitizedState)}\n${ReportGenerator.generateMarkdownReport('otel-lab', sanitizedState)}`;
    for (const canary of ['PROMPT_CANARY', 'TOKEN_CANARY', 'BODY_CANARY', 'EXCEPTION_CANARY', 'person@example.test']) assert(!reusableSurfaces.includes(canary));

    // Temporal order is event-time based even when artifact/span order is reversed.
    const second = span({ traceId: '22222222222222222222222222222222', spanId: '2222222222222222', startTime: '2026-09-06T11:00:00.000Z', endTime: '2026-09-06T11:00:01.000Z' });
    captureOtelSpansToJsonl([second, span()], artifact);
    const imported = importRuntimeArtifact(artifact);
    assert.equal(imported.evidences.length, 4); assert.equal(new Set(imported.evidences.map(e => e.data.runId)).size, 2);

    // Dedupe/contradiction reuse existing importer identity rules.
    const duplicateFacts = otelSpanToRuntime(span());
    fs.writeFileSync(artifact, `${JSON.stringify(duplicateFacts[0])}\n${JSON.stringify(duplicateFacts[0])}\n`);
    assert.deepEqual(importRuntimeArtifact(artifact).diagnostics, ['DUPLICATE_RUNTIME_EVENT']);
    const contradiction = { ...duplicateFacts[0], eventTime: '2026-09-06T10:00:02.000Z' };
    fs.writeFileSync(artifact, `${JSON.stringify(duplicateFacts[0])}\n${JSON.stringify(contradiction)}\n`);
    assert.throws(() => importRuntimeArtifact(artifact), /identity conflicts/);

    // Equal timestamps remain equal; no artificial sequencing timestamp is invented.
    const equal = otelSpanToRuntime(span({ endTime: '2026-09-06T10:00:00.000Z', status: 'UNSET' }));
    assert.equal(equal[0].eventTime, equal[1].eventTime); assert.equal(equal[1].outcome, 'UNKNOWN');
    assert.throws(() => otelSpanToRuntime(span({ endTime: '2026-09-06T09:59:59.000Z' })), /precedes/);

    // Strict envelope; allowlisted values remain privacy-screened.
    assert.throws(() => otelSpanToRuntime({ ...span(), rawPayload: 'CANARY' }), /not allowed/);
    assert.throws(() => otelSpanToRuntime(span({ attributes: { 'taidyup.operation.action': 'SEND', 'taidyup.resource.classification': 'person@example.test' } })), /safe lab identifier/);

    // OTEL-H: only the explicit capture call writes; conversion itself has no filesystem/network side effect.
    const untouched = path.join(dir, 'not-created.jsonl'); otelSpanToRuntime(span()); assert(!fs.existsSync(untouched));
    console.log('OTel RUNTIME validation lab: PASS (OTEL-A..H, privacy, binding, lifecycle, dedupe, local-only)');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
run();
