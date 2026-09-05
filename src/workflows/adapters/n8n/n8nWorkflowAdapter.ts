import crypto from 'node:crypto';
import { CapabilityAction, Claim, ConnectedSnapshotMetadata, Evidence, ResourceDescriptor, SourceType } from '../../../trust-kernel/types.js';
import { CredentialReference, ParameterFact, WorkflowArtifact, WorkflowComponent, WorkflowEdge, WorkflowRelation } from '../../model/workflowIr.js';

export class WorkflowAdapterError extends Error {
  constructor(message: string) { super(message); this.name = 'WorkflowAdapterError'; }
}

export interface WorkflowAdapterOutput { artifact: WorkflowArtifact; claims: Claim[]; evidences: Evidence[]; diagnostics: string[]; }
export interface WorkflowAdapterOptions {
  sourceType?: Extract<SourceType, 'STATIC' | 'CONNECTED'>;
  evidenceLayer?: 'OBSERVED' | 'CONNECTED';
  observedAt?: string;
  connectedSnapshot?: ConnectedSnapshotMetadata;
  sanitizeDisplayNames?: boolean;
}
type N8nNode = { id: string; name: string; type: string; typeVersion: number; disabled?: boolean; parameters: Record<string, unknown>; credentials?: Record<string, { id?: string; name?: string }> };
type Mapping = { action: CapabilityAction; resourceType: string; scope: string; rule: string };
const VERSION = '0.1.0';
const hash = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');
const expression = (value: unknown) => typeof value === 'string' && /(^|[^=])={{|^=/.test(value);
const sensitive = (key: string) => /(^|[._-])(api[-_]?key|authorization|token|secret|password|cookie|private[-_]?key)($|[._-])/i.test(key);

function flatten(value: unknown, base = 'parameters', out: ParameterFact[] = [], dynamic: string[] = []): { facts: ParameterFact[]; dynamic: string[] } {
  if (Array.isArray(value)) { value.forEach((item, i) => flatten(item, `${base}[${i}]`, out, dynamic)); return { facts: out, dynamic }; }
  if (value && typeof value === 'object') { Object.entries(value as Record<string, unknown>).forEach(([key, item]) => flatten(item, `${base}.${key}`, out, dynamic)); return { facts: out, dynamic }; }
  if (sensitive(base)) out.push({ path: base, classification: 'REDACTED', sanitizedValueOrHash: hash(String(value)) });
  else if (expression(value)) { out.push({ path: base, classification: 'EXPRESSION', sanitizedValueOrHash: hash(String(value)) }); dynamic.push(base); }
  else if (['string', 'number', 'boolean'].includes(typeof value)) out.push({ path: base, classification: 'LITERAL', sanitizedValueOrHash: hash(String(value)) });
  else out.push({ path: base, classification: 'UNKNOWN' });
  return { facts: out, dynamic };
}

function kind(node: N8nNode): WorkflowComponent['kind'] {
  const supported = node.typeVersion >= 1 && node.typeVersion < 5;
  if (!supported) return 'UNMAPPED';
  if (node.type === '@n8n/n8n-nodes-langchain.agent') return 'AGENT';
  if (/\.lm(Chat)?/i.test(node.type)) return 'MODEL';
  if (/\.memory/i.test(node.type)) return 'MEMORY';
  if (node.type === '@n8n/n8n-nodes-langchain.toolWorkflow') return 'SUBWORKFLOW';
  if (/trigger/i.test(node.type)) return 'TRIGGER';
  if (/gmailTool|sendEmailTool|postgresTool|httpRequestTool|executeCommandTool|toolCode$/i.test(node.type)) return 'TOOL';
  return 'UNMAPPED';
}

function mapTool(node: N8nNode): Mapping | undefined {
  if (kind(node) !== 'TOOL') return undefined;
  const op = String(node.parameters.operation ?? '').toLowerCase();
  if (/gmailTool|sendEmailTool/i.test(node.type) && op === 'send') return { action: 'SEND', resourceType: 'email', scope: 'outbound', rule: 'n8n-email-send-v1' };
  if (/postgresTool/i.test(node.type)) {
    if (['select', 'executequery'].includes(op) && !expression(node.parameters.operation)) return { action: 'READ', resourceType: 'database', scope: 'selected-operation', rule: 'n8n-postgres-read-v1' };
    if (['insert', 'update', 'delete'].includes(op)) return { action: 'WRITE', resourceType: 'database', scope: 'selected-operation', rule: 'n8n-postgres-write-v1' };
  }
  if (/executeCommandTool/i.test(node.type)) return { action: 'EXECUTE', resourceType: 'process', scope: 'configured-command', rule: 'n8n-command-v1' };
  if (/toolCode$/i.test(node.type)) return { action: 'EXECUTE', resourceType: 'code', scope: 'embedded-code', rule: 'n8n-code-tool-v1' };
  if (/httpRequestTool/i.test(node.type) && String(node.parameters.method ?? 'GET').toUpperCase() === 'GET' && !expression(node.parameters.url) && !expression(node.parameters.method)) return { action: 'READ', resourceType: 'http', scope: 'literal-endpoint', rule: 'n8n-http-get-v1' };
  return undefined;
}

function relation(channel: string): WorkflowRelation {
  if (channel === 'ai_tool') return 'TOOL_OF';
  if (channel === 'ai_languageModel') return 'MODEL_OF';
  if (channel === 'ai_memory') return 'MEMORY_OF';
  if (channel === 'error') return 'ERROR_TO';
  return 'CONTROL_FLOW_TO';
}

export class N8nWorkflowAdapter {
  static readonly MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;

  static adapt(raw: Buffer, sourcePath: string, options: WorkflowAdapterOptions = {}): WorkflowAdapterOutput {
    if (raw.byteLength > this.MAX_ARTIFACT_BYTES) throw new WorkflowAdapterError(`Workflow artifact exceeds ${this.MAX_ARTIFACT_BYTES} byte size limit.`);
    let parsed: any;
    try { parsed = JSON.parse(raw.toString('utf8')); } catch { throw new WorkflowAdapterError('Malformed workflow JSON.'); }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.nodes) || !parsed.connections || typeof parsed.connections !== 'object' || typeof parsed.name !== 'string') throw new WorkflowAdapterError('JSON is not a supported n8n workflow artifact.');
    const artifactHash = hash(raw);
    const sourceType = options.sourceType ?? 'STATIC';
    const evidenceLayer = options.evidenceLayer ?? (sourceType === 'CONNECTED' ? 'CONNECTED' : 'OBSERVED');
    const observedAt = options.observedAt ?? new Date().toISOString();
    if (sourceType === 'CONNECTED' && !options.connectedSnapshot) throw new WorkflowAdapterError('CONNECTED adaptation requires point-in-time snapshot metadata.');
    const workflowId = typeof parsed.id === 'string' ? parsed.id : undefined;
    const nodes = parsed.nodes.filter((item: any) => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.type === 'string' && typeof item.typeVersion === 'number' && item.parameters && typeof item.parameters === 'object') as N8nNode[];
    if (nodes.length !== parsed.nodes.length) throw new WorkflowAdapterError('Workflow contains an unsupported node structure.');
    if (new Set(nodes.map(node => node.id)).size !== nodes.length || new Set(nodes.map(node => node.name)).size !== nodes.length) throw new WorkflowAdapterError('Workflow node IDs and names must be unique.');
    const byName = new Map(nodes.map(node => [node.name, node]));
    const locator = (node: N8nNode) => ({ provider: 'n8n', workflowLocalId: workflowId, localId: node.id });
    const credentialReferences: CredentialReference[] = [];
    const components = nodes.map(node => {
      const { facts, dynamic } = flatten(node.parameters);
      const refs = Object.entries(node.credentials ?? {}).map(([type, ref]) => {
        const referenceHash = hash(`${type}\0${ref.id ?? ''}\0${ref.name ?? ''}`);
        credentialReferences.push({ componentLocalId: node.id, type, referenceHash, status: 'REFERENCE_OBSERVED' });
        return referenceHash;
      });
      return { locator: locator(node), displayName: options.sanitizeDisplayNames ? `node-${hash(node.name).slice(0, 12)}` : node.name, kind: kind(node), providerType: node.type, providerTypeVersion: node.typeVersion, configuredOperation: typeof node.parameters.operation === 'string' && !expression(node.parameters.operation) ? node.parameters.operation : undefined, configuredResource: typeof node.parameters.resource === 'string' && !expression(node.parameters.resource) ? node.parameters.resource : undefined, enabledState: node.disabled === true ? 'DISABLED' : 'ENABLED_IN_EXPORT', parameterFacts: facts, dynamicFields: dynamic, credentialRefs: refs } satisfies WorkflowComponent;
    });
    const edges: WorkflowEdge[] = [];
    for (const [sourceName, channels] of Object.entries(parsed.connections as Record<string, any>)) for (const [channel, outputs] of Object.entries(channels as Record<string, any>)) (outputs as any[]).forEach((group, sourceIndex) => (group ?? []).forEach((connection: any) => {
      const from = byName.get(sourceName); const to = byName.get(connection.node);
      if (!from || !to || connection.type !== channel) return;
      edges.push({ from: locator(from), to: locator(to), relation: relation(channel), providerChannel: channel, sourceIndex, targetIndex: connection.index });
      if (channel === 'ai_tool' && kind(from) === 'SUBWORKFLOW') edges.push({ from: locator(to), to: locator(from), relation: 'INVOKES_SUBWORKFLOW', providerChannel: channel, sourceIndex, targetIndex: connection.index });
    }));
    const artifact: WorkflowArtifact = { provider: 'n8n', artifactHash, workflowLocator: { provider: 'n8n', localId: workflowId, artifactHash }, displayName: options.sanitizeDisplayNames ? `workflow-${hash(parsed.name).slice(0, 12)}` : parsed.name, observedState: sourceType === 'CONNECTED' ? (parsed.active === true ? 'CURRENT_ACTIVE_TRUE' : parsed.active === false ? 'CURRENT_ACTIVE_FALSE' : 'CURRENT_ACTIVE_UNKNOWN') : (parsed.active === true ? 'EXPORTED_ACTIVE_TRUE' : parsed.active === false ? 'EXPORTED_ACTIVE_FALSE' : 'EXPORTED_ACTIVE_ABSENT'), components, edges, credentialReferences, sanitizedMetadata: { pinDataPresent: parsed.pinData != null && Object.keys(parsed.pinData).length > 0, sourcePath } };
    const claims: Claim[] = []; const diagnostics: string[] = [];
    const artifactData = {
      evidenceLayer,
      provider: 'n8n',
      artifactHash,
      workflow: { id: workflowId, name: artifact.displayName, configuredState: artifact.observedState },
      components: components.map(component => ({ locator: component.locator, kind: component.kind, providerType: component.providerType, providerTypeVersion: component.providerTypeVersion, enabledState: component.enabledState, configuredOperation: component.configuredOperation, configuredResource: component.configuredResource, dynamicFields: component.dynamicFields })),
      edges: edges.map(edge => ({ from: edge.from, to: edge.to, relation: edge.relation, providerChannel: edge.providerChannel })),
      credentialReferences,
      pinData: artifact.sanitizedMetadata.pinDataPresent ? 'PRESENT_REDACTED_NOT_EXECUTION_EVIDENCE' : 'ABSENT'
    };
    if (options.connectedSnapshot) Object.assign(artifactData, { connectedSnapshot: options.connectedSnapshot });
    const evidences: Evidence[] = [{ id: `ev-workflow-artifact-${artifactHash.slice(0, 16)}`, type: sourceType === 'CONNECTED' ? 'CONNECTED_WORKFLOW_SNAPSHOT' : 'WORKFLOW_ARTIFACT_OBSERVATION', sourceType, subject: `workflow:n8n:${workflowId ?? artifactHash.slice(0, 12)}`, observedAt, collectorId: 'taidyup-n8n-workflow-adapter', collectorVersion: VERSION, artifact: sourcePath, data: artifactData, strength: 'DEPENDENCY_ONLY', sha256: hash(JSON.stringify(artifactData)), provenance: { file: sourcePath } }];
    for (const edge of edges.filter(e => e.relation === 'TOOL_OF')) {
      const tool = nodes.find(n => n.id === edge.from.localId); const target = nodes.find(n => n.id === edge.to.localId);
      if (!tool || !target || kind(target) !== 'AGENT') continue;
      if (tool.disabled || target.disabled) { diagnostics.push(`DISABLED_COMPONENT_SUPPRESSED:${tool.id}`); continue; }
      if (kind(tool) === 'SUBWORKFLOW') { diagnostics.push(`SUBWORKFLOW_AUTHORITY_UNRESOLVED:${tool.id}`); continue; }
      const mapping = mapTool(tool); if (!mapping) { diagnostics.push(`UNMAPPED_TOOL:${tool.type}@${tool.typeVersion}`); continue; }
      const subject = `agent:n8n:${workflowId ?? artifactHash.slice(0, 12)}:${target.id}`;
      const resourceDescriptor: ResourceDescriptor = { namespace: 'workflow', version: '0', type: mapping.resourceType, scope: mapping.scope, artifact: tool.type };
      const evId = `ev-workflow-${artifactHash.slice(0, 12)}-${tool.id}-${mapping.action}`;
      const data = { capability: mapping.action, resource: `${mapping.resourceType}:${mapping.scope}`, resourceDescriptor, capabilityPathBound: true, evidenceLayer, ...(options.connectedSnapshot ? { connectedSnapshot: options.connectedSnapshot } : {}), componentLocator: { scheme: 'workflow', version: '0', revision: artifactHash, language: 'workflow', module: workflowId ?? 'export', qualifiedSymbol: tool.id, structuralFingerprint: hash(`${tool.type}@${tool.typeVersion}`) }, workflowProvenance: { provider: 'n8n', workflow: { id: workflowId, name: artifact.displayName }, component: { id: tool.id, type: tool.type, typeVersion: tool.typeVersion, operation: tool.parameters.operation }, graph: { fromNodeId: tool.id, toNodeId: target.id, relation: 'TOOL_OF', providerChannel: 'ai_tool' }, mappingRule: `${mapping.rule}@${VERSION}`, parameterFacts: components.find(c => c.locator.localId === tool.id)?.parameterFacts } };
      evidences.push({ id: evId, type: sourceType === 'CONNECTED' ? 'CONNECTED_WORKFLOW_CAPABILITY' : 'WORKFLOW_CAPABILITY_OBSERVATION', sourceType, subject, observedAt, collectorId: 'taidyup-n8n-workflow-adapter', collectorVersion: VERSION, artifact: sourcePath, location: `nodes[id=${tool.id}]`, data, strength: 'AGENT_BOUND', sha256: hash(JSON.stringify(data)), provenance: { file: sourcePath } });
      claims.push({ id: `claim-${evId}`, subject, predicate: 'CAN', action: mapping.action, resource: data.resource, resourceDescriptor, source: sourceType, status: 'INFERRED', provenance: [{ sourceType, artifact: sourcePath, location: `nodes[id=${tool.id}]`, snippet: options.sanitizeDisplayNames ? `${tool.id} --ai_tool--> ${target.id}` : `${tool.name} --ai_tool--> ${target.name}`, collectorId: 'taidyup-n8n-workflow-adapter', evidenceId: evId }] });
    }
    return { artifact, claims, evidences, diagnostics };
  }
}
