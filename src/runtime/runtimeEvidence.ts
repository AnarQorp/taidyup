import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  CapabilityAction, Evidence, RuntimeDimensionBinding, RuntimeEvidenceData,
  RuntimeEventKind, RuntimeOutcome
} from '../trust-kernel/types.js';

export const RUNTIME_SCHEMA_VERSION = '0.1' as const;
export const MAX_RUNTIME_EVENT_BYTES = 16 * 1024;
export const MAX_RUNTIME_ARTIFACT_BYTES = 2 * 1024 * 1024;
export const MAX_RUNTIME_EVENTS = 2_000;

const EVENT_KINDS = new Set<RuntimeEventKind>(['INVOCATION_ATTEMPTED', 'EXECUTION_STARTED', 'EXECUTION_COMPLETED', 'RESULT_OBSERVED']);
const ACTIONS = new Set<CapabilityAction>(['READ', 'WRITE', 'CREATE', 'UPDATE', 'DELETE', 'EXECUTE', 'SEND', 'PUBLISH', 'APPROVE', 'PURCHASE', 'TRANSFER', 'ADMIN']);
const BINDING_STATES = new Set(['UNBOUND', 'PARTIAL', 'BOUND', 'CONTRADICTED']);
const BINDING_METHODS = new Set(['CONTEXTUAL', 'STRUCTURAL', 'SOURCE_ASSERTED', 'ATTESTED']);
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{0,199}$/;
const SAFE_VALUE = /^[a-zA-Z0-9][a-zA-Z0-9 ._:@/-]{0,255}$/;
const SENSITIVE_VALUE = /(bearer\s|authorization|password|secret|token|api[_-]?key|cookie|https?:\/\/[^\s?]+\?[^\s]+|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;

const TOP_KEYS = new Set(['schemaVersion', 'eventKind', 'eventTime', 'operation', 'bindings', 'source', 'sourceEventId', 'observationScope', 'completeness', 'sanitization', 'outcome', 'runId', 'parentEventId', 'eventHash']);
const OPERATION_KEYS = new Set(['action', 'resource', 'constraints']);
const BINDINGS_KEYS = new Set(['subject', 'action', 'resource', 'constraints']);
const BINDING_KEYS = new Set(['state', 'method', 'value', 'evidence', 'evidenceRef']);
const SOURCE_KEYS = new Set(['kind', 'identity']);
const SCOPE_KEYS = new Set(['kind', 'id', 'startedAt', 'endedAt']);
const SANITIZATION_KEYS = new Set(['policy', 'rawPayloadPersisted', 'droppedFields']);

export class RuntimeArtifactError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'RuntimeArtifactError'; }
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RuntimeArtifactError('RUNTIME_EVENT_INVALID', `${field} must be an object.`);
  return value as Record<string, unknown>;
}

function allowed(value: Record<string, unknown>, keys: Set<string>, field: string): void {
  const unknown = Object.keys(value).filter(key => !keys.has(key));
  if (unknown.length) throw new RuntimeArtifactError('RUNTIME_UNKNOWN_FIELD', `${field}.${unknown[0]} is not allowed by runtime schema V0.`);
}

function safeString(value: unknown, field: string, id = false): string {
  if (typeof value !== 'string' || !(id ? SAFE_ID : SAFE_VALUE).test(value) || SENSITIVE_VALUE.test(value)) {
    throw new RuntimeArtifactError('RUNTIME_SENSITIVE_OR_INVALID_VALUE', `${field} is not a safe runtime identifier.`);
  }
  return value;
}

function iso(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new RuntimeArtifactError('RUNTIME_TIME_INVALID', `${field} must be a UTC ISO timestamp.`);
  }
  return value;
}

function canonical(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}

function hash(value: unknown): string { return crypto.createHash('sha256').update(canonical(value)).digest('hex'); }
function eventContent(data: RuntimeEvidenceData): unknown { const { eventHash: _ignored, ...content } = data; return content; }

function validateBinding(value: unknown, dimension: string): RuntimeDimensionBinding {
  const item = record(value, `bindings.${dimension}`); allowed(item, BINDING_KEYS, `bindings.${dimension}`);
  if (!BINDING_STATES.has(String(item.state))) throw new RuntimeArtifactError('RUNTIME_BINDING_INVALID', `${dimension} binding state is invalid.`);
  if (item.method !== undefined && !BINDING_METHODS.has(String(item.method))) throw new RuntimeArtifactError('RUNTIME_BINDING_INVALID', `${dimension} binding method is invalid.`);
  for (const key of ['value', 'evidence', 'evidenceRef']) if (item[key] !== undefined) safeString(item[key], `bindings.${dimension}.${key}`, key === 'evidenceRef');
  if (item.state === 'BOUND' && (!item.value || !item.method || !item.evidence || !item.evidenceRef)) {
    throw new RuntimeArtifactError('RUNTIME_BINDING_PROOF_REQUIRED', `${dimension} BOUND requires method, value, evidence and evidenceRef.`);
  }
  if (item.state === 'UNBOUND' && (item.method || item.evidence || item.evidenceRef)) throw new RuntimeArtifactError('RUNTIME_BINDING_INVALID', `${dimension} UNBOUND cannot claim binding proof.`);
  return item as unknown as RuntimeDimensionBinding;
}

export function validateRuntimeData(value: unknown): RuntimeEvidenceData {
  const root = record(value, 'event'); allowed(root, TOP_KEYS, 'event');
  if (root.schemaVersion !== RUNTIME_SCHEMA_VERSION) throw new RuntimeArtifactError('RUNTIME_SCHEMA_UNSUPPORTED', `Unsupported runtime schema ${String(root.schemaVersion)}.`);
  if (!EVENT_KINDS.has(root.eventKind as RuntimeEventKind)) throw new RuntimeArtifactError('RUNTIME_EVENT_KIND_UNKNOWN', `Unknown runtime event kind ${String(root.eventKind)}.`);
  iso(root.eventTime, 'eventTime'); safeString(root.sourceEventId, 'sourceEventId', true);
  if (root.runId !== undefined) safeString(root.runId, 'runId', true);
  if (root.parentEventId !== undefined) safeString(root.parentEventId, 'parentEventId', true);

  const operation = record(root.operation, 'operation'); allowed(operation, OPERATION_KEYS, 'operation');
  if (!ACTIONS.has(operation.action as CapabilityAction)) throw new RuntimeArtifactError('RUNTIME_ACTION_INVALID', 'A supported operation.action is required.');
  if (operation.resource !== undefined) safeString(operation.resource, 'operation.resource');
  if (operation.constraints !== undefined) {
    const constraints = record(operation.constraints, 'operation.constraints');
    if (Object.keys(constraints).length > 16) throw new RuntimeArtifactError('RUNTIME_FIELD_TOO_LARGE', 'operation.constraints contains too many entries.');
    for (const [key, item] of Object.entries(constraints)) {
      safeString(key, 'operation.constraints key', true);
      if (!['string', 'number', 'boolean'].includes(typeof item)) throw new RuntimeArtifactError('RUNTIME_EVENT_INVALID', `operation.constraints.${key} must be a primitive.`);
      if (typeof item === 'string') safeString(item, `operation.constraints.${key}`);
      if (typeof item === 'number' && !Number.isFinite(item)) throw new RuntimeArtifactError('RUNTIME_EVENT_INVALID', `operation.constraints.${key} must be finite.`);
    }
  }

  const bindings = record(root.bindings, 'bindings'); allowed(bindings, BINDINGS_KEYS, 'bindings');
  for (const dimension of BINDINGS_KEYS) validateBinding(bindings[dimension], dimension);

  const source = record(root.source, 'source'); allowed(source, SOURCE_KEYS, 'source');
  if (!['LOCAL_TOOL_WRAPPER', 'IMPORTED_ARTIFACT'].includes(String(source.kind))) throw new RuntimeArtifactError('RUNTIME_SOURCE_INVALID', 'Runtime source kind is invalid.');
  safeString(source.identity, 'source.identity', true);

  const scope = record(root.observationScope, 'observationScope'); allowed(scope, SCOPE_KEYS, 'observationScope');
  if (!['RUN', 'WINDOW'].includes(String(scope.kind))) throw new RuntimeArtifactError('RUNTIME_SCOPE_INVALID', 'Runtime scope kind is invalid.');
  safeString(scope.id, 'observationScope.id', true);
  if (scope.startedAt !== undefined) iso(scope.startedAt, 'observationScope.startedAt');
  if (scope.endedAt !== undefined) iso(scope.endedAt, 'observationScope.endedAt');
  if (root.completeness !== 'PARTIAL_OBSERVATION') throw new RuntimeArtifactError('RUNTIME_COMPLETENESS_UNSUPPORTED', 'Runtime V0 effective completeness must be PARTIAL_OBSERVATION.');

  const sanitization = record(root.sanitization, 'sanitization'); allowed(sanitization, SANITIZATION_KEYS, 'sanitization');
  if (sanitization.policy !== 'ALLOWLIST_V0' || sanitization.rawPayloadPersisted !== false || !Array.isArray(sanitization.droppedFields) || sanitization.droppedFields.length > 32) throw new RuntimeArtifactError('RUNTIME_SANITIZATION_INVALID', 'Runtime events require ALLOWLIST_V0 sanitization metadata.');
  sanitization.droppedFields.forEach((item, index) => safeString(item, `sanitization.droppedFields[${index}]`));

  if (root.eventKind === 'EXECUTION_COMPLETED' && !['SUCCEEDED', 'FAILED', 'UNKNOWN'].includes(String(root.outcome))) throw new RuntimeArtifactError('RUNTIME_OUTCOME_REQUIRED', 'Completion events require an explicit outcome.');
  if (root.eventKind !== 'EXECUTION_COMPLETED' && root.outcome !== undefined) throw new RuntimeArtifactError('RUNTIME_OUTCOME_INVALID', 'Only completion events may carry an outcome.');
  if (root.eventHash !== undefined) {
    if (typeof root.eventHash !== 'string' || !/^[a-f0-9]{64}$/.test(root.eventHash)) throw new RuntimeArtifactError('RUNTIME_EVENT_HASH_INVALID', 'eventHash must be SHA-256 hex.');
    if (root.eventHash !== hash(eventContent(root as unknown as RuntimeEvidenceData))) throw new RuntimeArtifactError('RUNTIME_EVENT_HASH_MISMATCH', 'eventHash does not match canonical sanitized event content.');
  }
  return root as unknown as RuntimeEvidenceData;
}

export function runtimeDataToEvidence(data: RuntimeEvidenceData, artifact: string, line: number): Evidence {
  const eventHash = hash(eventContent(data));
  const subject = data.bindings.subject.state === 'BOUND' && data.bindings.subject.value ? data.bindings.subject.value : 'runtime:unbound';
  return { id: `runtime-${eventHash.slice(0, 24)}`, type: `RUNTIME_${data.eventKind}`, sourceType: 'RUNTIME', subject, observedAt: data.eventTime, collectorId: 'taidyup.runtime-artifact-importer', collectorVersion: RUNTIME_SCHEMA_VERSION, artifact: path.basename(artifact), location: `line:${line}`, data: { ...data, eventHash }, strength: 'RUNTIME_CONFIRMED', sha256: eventHash, provenance: { file: path.basename(artifact), lineRange: String(line) } };
}

export function importRuntimeArtifact(artifactPath: string): { evidences: Evidence[]; diagnostics: string[] } {
  const resolved = path.resolve(artifactPath);
  let stat: fs.Stats;
  try { stat = fs.statSync(resolved); } catch { throw new RuntimeArtifactError('RUNTIME_ARTIFACT_UNREADABLE', 'Runtime artifact cannot be read.'); }
  if (!stat.isFile()) throw new RuntimeArtifactError('RUNTIME_ARTIFACT_NOT_FILE', 'Runtime artifact must be a file.');
  if (stat.size > MAX_RUNTIME_ARTIFACT_BYTES) throw new RuntimeArtifactError('RUNTIME_ARTIFACT_TOO_LARGE', 'Runtime artifact exceeds the V0 size limit.');
  const lines = fs.readFileSync(resolved, 'utf8').split(/\r?\n/).filter(line => line.trim());
  if (lines.length > MAX_RUNTIME_EVENTS) throw new RuntimeArtifactError('RUNTIME_ARTIFACT_TOO_MANY_EVENTS', 'Runtime artifact exceeds the V0 event count limit.');
  const seen = new Map<string, string>(); const evidences: Evidence[] = []; const diagnostics: string[] = [];
  lines.forEach((line, index) => {
    if (Buffer.byteLength(line) > MAX_RUNTIME_EVENT_BYTES) throw new RuntimeArtifactError('RUNTIME_EVENT_TOO_LARGE', `Runtime event at line ${index + 1} exceeds the V0 size limit.`);
    let parsed: unknown; try { parsed = JSON.parse(line); } catch { throw new RuntimeArtifactError('RUNTIME_JSONL_INVALID', `Malformed JSONL at line ${index + 1}.`); }
    const data = validateRuntimeData(parsed); const contentHash = hash(eventContent(data)); const identity = `${data.source.identity}\0${data.sourceEventId}`; const prior = seen.get(identity);
    if (prior === contentHash) { diagnostics.push('DUPLICATE_RUNTIME_EVENT'); return; }
    if (prior) throw new RuntimeArtifactError('RUNTIME_EVENT_ID_CONFLICT', `Runtime event identity conflicts at line ${index + 1}.`);
    seen.set(identity, contentHash); evidences.push(runtimeDataToEvidence(data, resolved, index + 1));
  });
  return { evidences, diagnostics: Array.from(new Set(diagnostics)) };
}

export interface EstablishedSubjectBinding { value: string; method: 'CONTEXTUAL' | 'STRUCTURAL' | 'ATTESTED'; evidence: string; evidenceRef: string; }
export interface LocalToolInvocation { subject?: string; establishedSubjectBinding?: EstablishedSubjectBinding; action: CapabilityAction; resource?: string; runId?: string; }

/** Deterministic local laboratory: records lifecycle facts, never arguments, results or raw exceptions. */
export class DeterministicLocalToolWrapper {
  constructor(private readonly artifactPath: string, private readonly sourceIdentity = 'taidyup.local-wrapper.v0', private readonly clock: () => string = () => new Date().toISOString(), private readonly executionId: () => string = () => crypto.randomUUID()) {}
  public invoke<T>(invocation: LocalToolInvocation, tool: () => T): T {
    const execution = `${invocation.runId ? `${safeString(invocation.runId, 'runId', true)}:` : ''}${safeString(this.executionId(), 'executionId', true)}`;
    let sequence = 0; let previous: string | undefined;
    const emit = (eventKind: RuntimeEventKind, outcome?: RuntimeOutcome): void => {
      const sourceEventId = `${execution}:${++sequence}:${eventKind}`;
      const proof = invocation.establishedSubjectBinding;
      if (proof && invocation.subject && proof.value !== invocation.subject) throw new RuntimeArtifactError('RUNTIME_SUBJECT_BINDING_MISMATCH', 'Established subject binding does not match supplied subject.');
      const subject: RuntimeDimensionBinding = proof ? { state: 'BOUND', method: proof.method, value: proof.value, evidence: proof.evidence, evidenceRef: proof.evidenceRef } : { state: 'UNBOUND', value: invocation.subject };
      const resource: RuntimeDimensionBinding = invocation.resource ? { state: 'PARTIAL', method: 'SOURCE_ASSERTED', value: invocation.resource, evidence: 'wrapper-operation-resource' } : { state: 'UNBOUND' };
      const data: RuntimeEvidenceData = { schemaVersion: RUNTIME_SCHEMA_VERSION, eventKind, eventTime: this.clock(), operation: { action: invocation.action, resource: invocation.resource }, bindings: { subject, action: { state: 'BOUND', method: 'STRUCTURAL', value: invocation.action, evidence: 'wrapper-operation-dispatch', evidenceRef: 'runtime-wrapper:operation' }, resource, constraints: { state: 'UNBOUND' } }, source: { kind: 'LOCAL_TOOL_WRAPPER', identity: this.sourceIdentity }, sourceEventId, observationScope: { kind: 'RUN', id: execution }, completeness: 'PARTIAL_OBSERVATION', sanitization: { policy: 'ALLOWLIST_V0', rawPayloadPersisted: false, droppedFields: ['arguments', 'result', 'exception'] }, outcome, runId: execution, parentEventId: previous };
      validateRuntimeData(data); fs.appendFileSync(this.artifactPath, `${JSON.stringify(data)}\n`, { encoding: 'utf8', mode: 0o600 }); previous = sourceEventId;
    };
    emit('INVOCATION_ATTEMPTED'); emit('EXECUTION_STARTED');
    try { const result = tool(); emit('EXECUTION_COMPLETED', 'SUCCEEDED'); return result; }
    catch (error) { emit('EXECUTION_COMPLETED', 'FAILED'); throw error; }
  }
}
