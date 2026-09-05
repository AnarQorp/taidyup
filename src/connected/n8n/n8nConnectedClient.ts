import crypto from 'node:crypto';
import net from 'node:net';
import { N8nWorkflowAdapter, WorkflowAdapterOutput } from '../../workflows/adapters/n8n/n8nWorkflowAdapter.js';
import { ConnectedSnapshotMetadata } from '../../trust-kernel/types.js';

export type ConnectorAuthorityMode = 'TECHNICALLY_READ_ONLY' | 'CLIENT_ENFORCED_READ_ONLY' | 'UNKNOWN';

export interface N8nConnectionConfig {
  provider: 'n8n';
  baseUrl: string;
  /** Resolved only in memory by the caller. Never serialized into evidence. */
  token: string;
  connectionId: string;
  authorityMode: ConnectorAuthorityMode;
  allowLoopbackHttp?: boolean;
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxPages?: number;
}

export interface N8nConnectedSnapshot extends ConnectedSnapshotMetadata {
  provider: 'n8n';
  observedAt: string;
  workflowId: string;
  responseHash: string;
  draftRevision?: string;
  activeRevision?: string;
  authorityMode: ConnectorAuthorityMode;
  declaredAuthorityMode: ConnectorAuthorityMode;
  authorityModeBasis: 'CLIENT_GUARD_ENFORCED' | 'NOT_PROVIDER_VERIFIED';
  sourceIdentityStrength: 'CONFIGURED_ENDPOINT_AND_LOCAL_CONNECTION';
}

export interface N8nConnectedResult extends WorkflowAdapterOutput {
  snapshot: N8nConnectedSnapshot;
  inventoryCount: number;
  disclosure: { provider: 'n8n'; host: string; endpointClasses: string[]; authorityMode: ConnectorAuthorityMode; declaredAuthorityMode: ConnectorAuthorityMode; authorityModeBasis: 'CLIENT_GUARD_ENFORCED' | 'NOT_PROVIDER_VERIFIED'; executesWorkflows: false };
}

export class ConnectedTransportError extends Error {
  constructor(public readonly code: string, message: string, public readonly snapshotCompleteness: 'PARTIAL' | 'UNKNOWN_COMPLETENESS' = 'UNKNOWN_COMPLETENESS') {
    super(message); this.name = 'ConnectedTransportError';
  }
}

const sha256 = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');
const defaults = { timeoutMs: 10_000, maxResponseBytes: 5 * 1024 * 1024, maxPages: 20 };

function loopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '::1' || (net.isIP(hostname) === 4 && hostname.startsWith('127.'));
}

function statusCode(status: number): string {
  if (status === 401) return 'AUTHENTICATION_FAILED';
  if (status === 403) return 'ACCESS_DENIED';
  if (status === 404) return 'NOT_FOUND_UNRESOLVED';
  if (status === 429) return 'RATE_LIMITED';
  return 'SOURCE_UNAVAILABLE';
}

function safeWorkflow(value: any): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new ConnectedTransportError('UNSUPPORTED_RESPONSE', 'n8n response did not contain a workflow object.');
  const allowed: Record<string, unknown> = {};
  for (const key of ['id', 'name', 'active', 'versionId', 'activeVersionId', 'updatedAt', 'nodes', 'connections', 'settings']) if (key in value) allowed[key] = value[key];
  // Pinned, execution, static and unknown response fields are intentionally dropped before normalization.
  return allowed;
}

export class N8nConnectedClient {
  static readonly VERSION = '0.1.0';

  static assertMethod(method: string): void {
    if (method !== 'GET' && method !== 'HEAD') throw new ConnectedTransportError('METHOD_FORBIDDEN', `Mutating HTTP method ${method} is forbidden.`);
  }

  static validateConfig(config: N8nConnectionConfig): URL {
    if (config.provider !== 'n8n') throw new ConnectedTransportError('INVALID_CONFIG', 'Only provider n8n is supported.');
    let url: URL; try { url = new URL(config.baseUrl); } catch { throw new ConnectedTransportError('INVALID_CONFIG', 'baseUrl must be an absolute URL.'); }
    if (url.username || url.password) throw new ConnectedTransportError('INVALID_CONFIG', 'URL-embedded credentials are forbidden.');
    if (url.search || url.hash) throw new ConnectedTransportError('INVALID_CONFIG', 'baseUrl query strings and fragments are forbidden.');
    if (/^(0\.0\.0\.0|169\.254\.|\[?::\]?)/.test(url.hostname)) throw new ConnectedTransportError('INVALID_CONFIG', 'Unspecified and link-local target addresses are forbidden.');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && config.allowLoopbackHttp === true && loopback(url.hostname))) throw new ConnectedTransportError('INVALID_CONFIG', 'HTTPS is required except explicit loopback development opt-in.');
    if (!config.token || !config.connectionId) throw new ConnectedTransportError('INVALID_CONFIG', 'token and connectionId are required.');
    return url;
  }

  private static async getJson(base: URL, path: string, config: N8nConnectionConfig, partial = false): Promise<any> {
    this.assertMethod('GET');
    const url = new URL(path, base);
    if (url.origin !== base.origin) throw new ConnectedTransportError('ORIGIN_MISMATCH', 'Request origin differs from configured source.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? defaults.timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', headers: { accept: 'application/json', 'X-N8N-API-KEY': config.token }, redirect: 'manual', signal: controller.signal });
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new ConnectedTransportError('TIMEOUT', 'CONNECTED source request timed out.', partial ? 'PARTIAL' : 'UNKNOWN_COMPLETENESS');
      throw new ConnectedTransportError('SOURCE_UNAVAILABLE', 'CONNECTED source request failed.', partial ? 'PARTIAL' : 'UNKNOWN_COMPLETENESS');
    } finally { clearTimeout(timer); }
    if (response.status >= 300 && response.status < 400) throw new ConnectedTransportError('REDIRECT_REJECTED', 'Redirect responses are rejected.', partial ? 'PARTIAL' : 'UNKNOWN_COMPLETENESS');
    if (!response.ok) throw new ConnectedTransportError(statusCode(response.status), `CONNECTED source returned HTTP ${response.status}.`, partial ? 'PARTIAL' : 'UNKNOWN_COMPLETENESS');
    if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) throw new ConnectedTransportError('UNEXPECTED_CONTENT_TYPE', 'CONNECTED source did not return JSON.', partial ? 'PARTIAL' : 'UNKNOWN_COMPLETENESS');
    const limit = config.maxResponseBytes ?? defaults.maxResponseBytes;
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > limit) throw new ConnectedTransportError('RESPONSE_TOO_LARGE', 'CONNECTED source response exceeded the configured size limit.', partial ? 'PARTIAL' : 'UNKNOWN_COMPLETENESS');
    const reader = response.body?.getReader(); if (!reader) throw new ConnectedTransportError('UNEXPECTED_BODY', 'CONNECTED source response body was unavailable.');
    const chunks: Uint8Array[] = []; let total = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > limit) { await reader.cancel(); throw new ConnectedTransportError('RESPONSE_TOO_LARGE', 'CONNECTED source response exceeded the configured size limit.', partial ? 'PARTIAL' : 'UNKNOWN_COMPLETENESS'); } chunks.push(value); }
    const bytes = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
    try { return JSON.parse(bytes.toString('utf8')); } catch { throw new ConnectedTransportError('MALFORMED_JSON', 'CONNECTED source returned malformed JSON.', partial ? 'PARTIAL' : 'UNKNOWN_COMPLETENESS'); }
  }

  static async collect(config: N8nConnectionConfig, workflowId: string): Promise<N8nConnectedResult> {
    const base = this.validateConfig(config);
    if (!/^[A-Za-z0-9_-]+$/.test(workflowId)) throw new ConnectedTransportError('INVALID_WORKFLOW_ID', 'workflowId contains unsupported characters.');
    const seen = new Set<string>(); let cursor: string | undefined; let inventoryCount = 0; let page = 0; let inventoryRevision: string | undefined;
    do {
      if (page >= (config.maxPages ?? defaults.maxPages)) throw new ConnectedTransportError('PAGINATION_LIMIT', 'Workflow inventory exceeded the pagination limit.', 'PARTIAL');
      const query = new URLSearchParams({ excludePinnedData: 'true', limit: '100' }); if (cursor) query.set('cursor', cursor);
      const body = await this.getJson(base, `/api/v1/workflows?${query}`, config, page > 0);
      if (!Array.isArray(body?.data)) throw new ConnectedTransportError('UNSUPPORTED_RESPONSE', 'Workflow inventory response has unsupported structure.', page > 0 ? 'PARTIAL' : 'UNKNOWN_COMPLETENESS');
      inventoryCount += body.data.length; page++;
      const selected = body.data.find((item: any) => item?.id === workflowId);
      if (selected && typeof selected.versionId === 'string') inventoryRevision = selected.versionId;
      const next = typeof body.nextCursor === 'string' && body.nextCursor ? body.nextCursor : undefined;
      if (next && seen.has(next)) throw new ConnectedTransportError('INCONSISTENT_PAGINATION', 'Workflow inventory cursor repeated; snapshot is incomplete.', 'PARTIAL');
      if (next) seen.add(next); cursor = next;
    } while (cursor);

    const response = await this.getJson(base, `/api/v1/workflows/${encodeURIComponent(workflowId)}?excludePinnedData=true`, config);
    const sanitized = safeWorkflow(response);
    if (inventoryRevision && typeof sanitized.versionId === 'string' && inventoryRevision !== sanitized.versionId) throw new ConnectedTransportError('INCONSISTENT_SNAPSHOT', 'Workflow changed between inventory and exact retrieval.', 'PARTIAL');
    const observedAt = new Date().toISOString();
    const sourceInstance = `n8n:${config.connectionId}:${sha256(base.origin).slice(0, 16)}`;
    const effectiveAuthorityMode: ConnectorAuthorityMode = config.authorityMode === 'CLIENT_ENFORCED_READ_ONLY' ? 'CLIENT_ENFORCED_READ_ONLY' : 'UNKNOWN';
    const authorityModeBasis = config.authorityMode === 'CLIENT_ENFORCED_READ_ONLY' ? 'CLIENT_GUARD_ENFORCED' : 'NOT_PROVIDER_VERIFIED';
    const snapshot: N8nConnectedSnapshot = {
      provider: 'n8n', mode: 'POINT_IN_TIME', sourceInstance, scope: `workflow:${workflowId}`, completeness: 'COMPLETE', retrievalStatus: 'SUCCESS',
      revision: typeof sanitized.versionId === 'string' ? sanitized.versionId : typeof sanitized.updatedAt === 'string' ? sanitized.updatedAt : undefined,
      observedAt, workflowId, responseHash: sha256(JSON.stringify(sanitized)), draftRevision: typeof sanitized.versionId === 'string' ? sanitized.versionId : undefined,
      activeRevision: typeof sanitized.activeVersionId === 'string' ? sanitized.activeVersionId : undefined, authorityMode: effectiveAuthorityMode,
      declaredAuthorityMode: config.authorityMode, authorityModeBasis, sourceIdentityStrength: 'CONFIGURED_ENDPOINT_AND_LOCAL_CONNECTION'
    };
    const source = `connected:n8n:${config.connectionId}:workflow:${workflowId}`;
    const adapted = N8nWorkflowAdapter.adapt(Buffer.from(JSON.stringify(sanitized)), source, { sourceType: 'CONNECTED', evidenceLayer: 'CONNECTED', observedAt, connectedSnapshot: snapshot, sanitizeDisplayNames: true });
    return { ...adapted, snapshot, inventoryCount, disclosure: { provider: 'n8n', host: base.origin, endpointClasses: ['workflow:list', 'workflow:read'], authorityMode: effectiveAuthorityMode, declaredAuthorityMode: config.authorityMode, authorityModeBasis, executesWorkflows: false } };
  }
}
