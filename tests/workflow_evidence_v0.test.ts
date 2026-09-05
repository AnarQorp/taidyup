import assert from 'node:assert/strict';
import { N8nWorkflowAdapter, WorkflowAdapterError } from '../src/workflows/adapters/n8n/n8nWorkflowAdapter.js';
import { ReconciliationEngine } from '../src/trust-kernel/reconciliationEngine.js';

const agent = (id = 'agent-1', name = 'Agent') => ({ id, name, type: '@n8n/n8n-nodes-langchain.agent', typeVersion: 1.7, position: [0, 0], parameters: {} });
const node = (id: string, name: string, type: string, parameters: any = {}, extra: any = {}) => ({ id, name, type, typeVersion: 1, position: [0, 0], parameters, ...extra });
const workflow = (nodes: any[], connections: any = {}, extra: any = {}) => Buffer.from(JSON.stringify({ id: 'wf-1', name: 'Workflow', nodes, connections, settings: {}, ...extra }));
const toolEdge = (tool: string, target = 'Agent') => ({ [tool]: { ai_tool: [[{ node: target, type: 'ai_tool', index: 0 }]] } });
const adapt = (raw: Buffer) => N8nWorkflowAdapter.adapt(raw, 'fixture.json');

function capability(result: ReturnType<typeof adapt>, action: string) {
  return result.evidences.filter(e => e.type === 'WORKFLOW_CAPABILITY_OBSERVATION' && e.data.capability === action);
}

// RED A/B: typed binding, never coexistence.
{
  const gmail = node('gmail-1', 'Gmail', 'n8n-nodes-base.gmailTool', { resource: 'message', operation: 'send', sendTo: 'dev@example.test' });
  assert.equal(capability(adapt(workflow([agent(), gmail], toolEdge('Gmail'))), 'SEND').length, 1);
  assert.equal(capability(adapt(workflow([agent(), gmail])), 'SEND').length, 0);
}

// RED C: dynamic HTTP must not fabricate action/resource.
{
  const http = node('http-1', 'HTTP', 'n8n-nodes-base.httpRequestTool', { method: '={{$json.method}}', url: '={{$json.url}}' });
  const result = adapt(workflow([agent(), http], toolEdge('HTTP')));
  assert.equal(result.claims.length, 0);
  assert.ok(result.artifact.components.find(c => c.locator.localId === 'http-1')?.dynamicFields.length);
}

// RED D/N: credential references only and embedded secrets never survive output.
{
  const secret = 'sk-super-secret-value';
  const gmail = node('gmail-1', 'Gmail', 'n8n-nodes-base.gmailTool', { operation: 'send', apiKey: secret }, { credentials: { gmailOAuth2: { id: 'cred-123', name: 'Production Gmail' } } });
  const result = adapt(workflow([agent(), gmail], toolEdge('Gmail')));
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, new RegExp(secret));
  assert.doesNotMatch(serialized, /Production Gmail|cred-123/);
  assert.equal(result.artifact.credentialReferences[0].status, 'REFERENCE_OBSERVED');
  assert.doesNotMatch(serialized, /SCOPE_VERIFIED|CREDENTIAL_VALID|CREDENTIAL_ACTIVE/);
}

// RED E/G: disabled or disconnected consequential nodes emit no bound authority.
{
  const command = node('cmd-1', 'Command', 'n8n-nodes-base.executeCommandTool', { command: 'date' }, { disabled: true });
  const bound = adapt(workflow([agent(), command], toolEdge('Command')));
  assert.equal(capability(bound, 'EXECUTE').length, 0);
  assert.equal(bound.artifact.components.find(c => c.locator.localId === 'cmd-1')?.enabledState, 'DISABLED');
  const disconnected = adapt(workflow([agent(), { ...command, disabled: false }]));
  assert.equal(capability(disconnected, 'EXECUTE').length, 0);
}

// RED F: unrelated human node is not an approval constraint.
{
  const human = node('human-1', 'Confirm', '@n8n/n8n-nodes-langchain.toolHumanReview', {});
  const result = adapt(workflow([agent(), human]));
  assert.equal(result.evidences.some(e => e.data?.constraintEvidence?.approval_required === true), false);
}

// RED H: subworkflow invocation is observed, child authority is not flattened.
{
  const child = node('sub-1', 'Child', '@n8n/n8n-nodes-langchain.toolWorkflow', { workflowId: { value: 'child-42', mode: 'id' } });
  const result = adapt(workflow([agent(), child], toolEdge('Child')));
  assert.ok(result.artifact.edges.some(e => e.relation === 'INVOKES_SUBWORKFLOW'));
  assert.equal(result.claims.length, 0);
}

// RED I: a Code tool is EXECUTE-code only.
{
  const code = node('code-1', 'Code', '@n8n/n8n-nodes-langchain.toolCode', { jsCode: 'fetch("https://example.test")' });
  const result = adapt(workflow([agent(), code], toolEdge('Code')));
  assert.equal(capability(result, 'EXECUTE').length, 1);
  assert.equal(result.claims.some(c => ['READ', 'WRITE', 'SEND'].includes(c.action || '')), false);
}

// RED J/M: exported active and pinData are metadata, never execution evidence/payload.
{
  const payload = 'private-pinned-payload';
  const result = adapt(workflow([agent()], {}, { active: true, pinData: { Agent: [{ json: { payload } }] } }));
  assert.equal(result.artifact.observedState, 'EXPORTED_ACTIVE_TRUE');
  assert.equal(result.evidences.some(e => e.sourceType === 'RUNTIME'), false);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(payload));
}

// RED K: exact target name binds one of two agents only.
{
  const gmail = node('gmail-1', 'Gmail', 'n8n-nodes-base.gmailTool', { operation: 'send' });
  const result = adapt(workflow([agent('a1', 'Agent A'), agent('a2', 'Agent B'), gmail], toolEdge('Gmail', 'Agent B')));
  assert.equal(capability(result, 'SEND')[0].subject, 'agent:n8n:wf-1:a2');
}

// RED L: unsupported type/version remains unmapped.
{
  const unknown = node('x-1', 'Mystery', 'community.superTool', { operation: 'send' });
  const result = adapt(workflow([agent(), unknown], toolEdge('Mystery')));
  assert.equal(result.claims.length, 0);
  assert.equal(result.artifact.components.find(c => c.locator.localId === 'x-1')?.kind, 'UNMAPPED');
}

// Input safety and Trust Kernel E2E: undeclared authority remains observation, not authorization.
{
  assert.throws(() => adapt(Buffer.from('{')), WorkflowAdapterError);
  assert.throws(() => adapt(Buffer.from('{}')), WorkflowAdapterError);
  const huge = Buffer.alloc(N8nWorkflowAdapter.MAX_ARTIFACT_BYTES + 1, 0x20);
  assert.throws(() => adapt(huge), /size limit/);
  const gmail = node('gmail-1', 'Gmail', 'n8n-nodes-base.gmailTool', { operation: 'send' });
  const result = adapt(workflow([agent(), gmail], toolEdge('Gmail')));
  const state = ReconciliationEngine.reconcile(result.claims, result.evidences);
  assert.equal(state.summary.undeclaredCount, 1);
  assert.equal(state.reconciledClaims[0].status, 'UNDECLARED_OBSERVATION');
  const observed = result.claims[0];
  const ownerReviewed = { ...observed, id: 'declared-send', source: 'DECLARATION' as const, status: 'DECLARED' as const, provenance: [{ sourceType: 'DECLARATION' as const, artifact: 'taidyup.json' }] };
  const aligned = ReconciliationEngine.reconcile([ownerReviewed, ...result.claims], result.evidences);
  assert.equal(aligned.reconciledClaims[0].status, 'SUPPORTED');
  const constrained = { ...ownerReviewed, id: 'declared-send-with-approval', constraints: { approval_required: true } };
  const unresolved = ReconciliationEngine.reconcile([constrained, ...result.claims], result.evidences);
  assert.equal(unresolved.reconciledClaims[0].status, 'UNVERIFIED');
  assert.equal(unresolved.reconciledClaims[0].assessment?.constraints.approval_required, 'UNVERIFIED');
  assert.equal(result.evidences[0].sourceType, 'STATIC');
  assert.equal(result.evidences.some(e => /AUTHORI[ZS]ED/.test(JSON.stringify(e.data))), false);
}

console.log('Workflow Evidence V0 RED suite: 14/14 PASS');
