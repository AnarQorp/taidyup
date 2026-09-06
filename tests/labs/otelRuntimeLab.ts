import fs from 'fs';
import type { CapabilityAction, RuntimeDimensionBinding, RuntimeEvidenceData } from '../../src/trust-kernel/types.js';
import { RUNTIME_SCHEMA_VERSION, validateRuntimeData } from '../../src/runtime/runtimeEvidence.js';

const ACTIONS = new Set<CapabilityAction>(['READ', 'WRITE', 'CREATE', 'UPDATE', 'DELETE', 'EXECUTE', 'SEND', 'PUBLISH', 'APPROVE', 'PURCHASE', 'TRANSFER', 'ADMIN']);
const ENVELOPE_KEYS = new Set(['traceId', 'spanId', 'parentSpanId', 'name', 'kind', 'startTime', 'endTime', 'status', 'resource', 'attributes']);
const RESOURCE_KEYS = new Set(['service.name']);
const ATTRIBUTE_KEYS = new Set(['taidyup.operation.action', 'taidyup.resource.classification']);
const SAFE = /^[a-zA-Z0-9][a-zA-Z0-9 ._:@/-]{0,199}$/;
const SENSITIVE = /(bearer\s|authorization|password|secret|token|api[_-]?key|cookie|https?:\/\/[^\s?]+\?[^\s]+|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;
const TRACE_ID = /^[a-f0-9]{32}$/;
const SPAN_ID = /^[a-f0-9]{16}$/;

export interface OtelSpanEnvelope {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'INTERNAL' | 'CLIENT' | 'SERVER' | 'PRODUCER' | 'CONSUMER';
  startTime: string;
  endTime?: string;
  status: 'OK' | 'ERROR' | 'UNSET';
  resource?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
}

export interface IndependentLabSubjectBinding {
  value: string;
  method: 'CONTEXTUAL' | 'STRUCTURAL' | 'ATTESTED';
  evidence: string;
  evidenceRef: string;
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: Set<string>, name: string): void {
  const unknown = Object.keys(value).find(key => !keys.has(key));
  if (unknown) throw new Error(`${name}.${unknown} is not allowed in the OTel lab envelope`);
}

function safe(value: unknown, name: string): string {
  if (typeof value !== 'string' || !SAFE.test(value) || SENSITIVE.test(value)) throw new Error(`${name} is not a safe lab identifier`);
  return value;
}

function time(value: unknown, name: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)) || !value.endsWith('Z')) throw new Error(`${name} must be a UTC timestamp`);
  return value;
}

/** [TEST ONLY] Strict adapter from a bounded OTel span envelope to existing RUNTIME V0 facts. */
export function otelSpanToRuntime(spanValue: unknown, independentBinding?: IndependentLabSubjectBinding): RuntimeEvidenceData[] {
  const span = object(spanValue, 'span'); exactKeys(span, ENVELOPE_KEYS, 'span');
  const traceId = safe(span.traceId, 'traceId'); const spanId = safe(span.spanId, 'spanId');
  if (!TRACE_ID.test(traceId) || /^0+$/.test(traceId)) throw new Error('traceId must be 16-byte lowercase hex');
  if (!SPAN_ID.test(spanId) || /^0+$/.test(spanId)) throw new Error('spanId must be 8-byte lowercase hex');
  if (span.parentSpanId !== undefined && (!SPAN_ID.test(safe(span.parentSpanId, 'parentSpanId')) || /^0+$/.test(String(span.parentSpanId)))) throw new Error('parentSpanId must be 8-byte lowercase hex');
  safe(span.name, 'name'); time(span.startTime, 'startTime');
  if (!['INTERNAL', 'CLIENT', 'SERVER', 'PRODUCER', 'CONSUMER'].includes(String(span.kind))) throw new Error('span.kind is invalid');
  if (!['OK', 'ERROR', 'UNSET'].includes(String(span.status))) throw new Error('span.status is invalid');
  if (span.endTime !== undefined && Date.parse(time(span.endTime, 'endTime')) < Date.parse(String(span.startTime))) throw new Error('endTime precedes startTime');

  const resource = span.resource === undefined ? {} : object(span.resource, 'resource'); exactKeys(resource, RESOURCE_KEYS, 'resource');
  if (resource['service.name'] !== undefined) safe(resource['service.name'], 'resource.service.name');
  const attributes = span.attributes === undefined ? {} : object(span.attributes, 'attributes');
  const action = attributes['taidyup.operation.action'];
  if (!ACTIONS.has(action as CapabilityAction)) throw new Error('allowlisted taidyup.operation.action is required');
  const resourceClass = attributes['taidyup.resource.classification'];
  if (resourceClass !== undefined) safe(resourceClass, 'attributes.taidyup.resource.classification');

  const subject: RuntimeDimensionBinding = independentBinding
    ? { state: 'BOUND', method: independentBinding.method, value: safe(independentBinding.value, 'binding.value'), evidence: safe(independentBinding.evidence, 'binding.evidence'), evidenceRef: safe(independentBinding.evidenceRef, 'binding.evidenceRef') }
    : { state: 'UNBOUND' };
  const operationResource = resourceClass as string | undefined;
  const bindingResource: RuntimeDimensionBinding = operationResource
    ? { state: 'BOUND', method: 'SOURCE_ASSERTED', value: operationResource, evidence: 'allowlisted-otel-resource-class', evidenceRef: 'otel-lab:resource-classification' }
    : { state: 'UNBOUND' };
  const scopeId = `${traceId}/${spanId}`;
  const droppedFields = Object.keys(attributes).some(key => !ATTRIBUTE_KEYS.has(key)) ? ['otel-attributes'] : [];
  const make = (eventKind: 'EXECUTION_STARTED' | 'EXECUTION_COMPLETED', eventTime: string): RuntimeEvidenceData => validateRuntimeData({
    schemaVersion: RUNTIME_SCHEMA_VERSION, eventKind, eventTime,
    operation: { action, ...(operationResource ? { resource: operationResource } : {}) },
    bindings: { subject, action: { state: 'BOUND', method: 'SOURCE_ASSERTED', value: action, evidence: 'allowlisted-otel-operation', evidenceRef: 'otel-lab:operation' }, resource: bindingResource, constraints: { state: 'UNBOUND' } },
    source: { kind: 'IMPORTED_ARTIFACT', identity: 'taidyup.otel-lab.v0' },
    sourceEventId: `${traceId}:${spanId}:${eventKind}`, observationScope: { kind: 'RUN', id: scopeId },
    completeness: 'PARTIAL_OBSERVATION', sanitization: { policy: 'ALLOWLIST_V0', rawPayloadPersisted: false, droppedFields },
    runId: scopeId, ...(eventKind === 'EXECUTION_COMPLETED' ? { outcome: span.status === 'OK' ? 'SUCCEEDED' : span.status === 'ERROR' ? 'FAILED' : 'UNKNOWN', parentEventId: `${traceId}:${spanId}:EXECUTION_STARTED` } : {})
  });
  const facts = [make('EXECUTION_STARTED', String(span.startTime))];
  if (span.endTime !== undefined) facts.push(make('EXECUTION_COMPLETED', String(span.endTime)));
  return facts;
}

/** [TEST ONLY] Local capture; no receiver, socket, exporter, provider, or background process. */
export function captureOtelSpansToJsonl(spans: unknown[], artifactPath: string, binding?: IndependentLabSubjectBinding): void {
  const facts = spans.flatMap(span => otelSpanToRuntime(span, binding));
  fs.writeFileSync(artifactPath, `${facts.map(fact => JSON.stringify(fact)).join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
}
