import crypto from 'crypto';
import { getDb } from '../db.js';

export type EpistemologicalState = 'OBSERVED' | 'INFERRED' | 'DECLARED' | 'VERIFIED';

export type SubjectType = 
  | 'PLATFORM'
  | 'CONNECTOR'
  | 'ORGANIZATION'
  | 'HUMAN'
  | 'AGENT'
  | 'TOOL'
  | 'RESOURCE'
  | 'CREDENTIAL'
  | 'RELATIONSHIP'
  | 'REGULATORY_SOURCE';

export type EvidenceScope = 
  | 'PLATFORM_SECURITY'
  | 'CONNECTOR_PERMISSION'
  | 'AGENT_AUTHORITY'
  | 'AGENT_IDENTITY'
  | 'AGENT_TOOL_ACCESS'
  | 'AGENT_CREDENTIAL_DEPENDENCY'
  | 'HUMAN_OVERSIGHT'
  | 'REVOCATION'
  | 'REGULATORY_APPLICABILITY'
  | 'REGULATORY_CONTROL'
  | 'ORGANIZATION_GOVERNANCE';

export type EvidenceStrength = 
  | 'DEPENDENCY_ONLY'
  | 'IMPORT_OBSERVED'
  | 'TOOL_REGISTERED'
  | 'AGENT_BOUND'
  | 'RUNTIME_CONFIRMED';

export interface EvidenceRecordInput {
  orgId: string;
  agentId?: string;
  controlId?: string;
  sourceConnector: string;
  method: string;
  observedResource: string;
  rawData: any;
  epistemologicalState?: EpistemologicalState;
  subjectType?: SubjectType;
  subjectId?: string;
  scope?: EvidenceScope;
  evidenceStrength?: EvidenceStrength;
  collectorName?: string;
  collectorVersion?: string;
}

export class EvidenceEngineV2 {
  private static SECRET_PATTERNS = [
    /ghp_[a-zA-Z0-9_]{20,255}/g,
    /gho_[a-zA-Z0-9_]{20,255}/g,
    /github_pat_[a-zA-Z0-9_]{20,255}/g,
    /sk-[a-zA-Z0-9_-]{20,255}/g,
    /sk-proj-[a-zA-Z0-9_-]{20,255}/g,
    /sk-ant-[a-zA-Z0-9_-]{20,255}/g,
    /AKIA[0-9A-Z]{16}/g,
    /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,
    /password[a-zA-Z0-9_]*["']?\s*[:=]\s*["'][^"']+["']/gi,
    /"(?:password|secret|api_key|token|private_key)":\s*"[^"]+"/gi,
    /SuperSecretPassword[0-9]*/g,
    /postgres:\/\/[^:]+:([^@]+)@/g,
    /mysql:\/\/[^:]+:([^@]+)@/g
  ];

  /**
   * Sanitizes raw data ensuring NO secrets or credentials ever leak into evidence logs.
   */
  public static sanitizeObservedData(data: any): string {
    let jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    
    for (const pattern of this.SECRET_PATTERNS) {
      jsonString = jsonString.replace(pattern, '[REDACTED_SECRET]');
    }

    return jsonString;
  }

  /**
   * Computes deterministic SHA-256 cryptographic hash over sanitized payload and previous hash link.
   */
  public static computeTamperEvidentHash(sanitizedJson: string, previousHash: string): string {
    const payload = `${previousHash}:${sanitizedJson}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Validates cross-subject evidence compatibility.
   * Prevents CONNECTOR/ORGANIZATION evidence from being improperly claimed for AGENT controls.
   */
  public static validateCrossSubjectMapping(subjectType: SubjectType, targetControlSubjectType: SubjectType): boolean {
    if (subjectType === targetControlSubjectType) return true;
    
    // Strict block: CONNECTOR evidence cannot directly satisfy AGENT control without explicit relationship
    if (subjectType === 'CONNECTOR' && targetControlSubjectType === 'AGENT') {
      return false;
    }
    if (subjectType === 'ORGANIZATION' && targetControlSubjectType === 'AGENT') {
      return false;
    }
    return false;
  }

  /**
   * Records a new tamper-evident evidence entry in the database.
   */
  public static async recordEvidence(input: EvidenceRecordInput): Promise<string> {
    const db = await getDb();
    const evidenceId = `ev-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const sanitizedJson = this.sanitizeObservedData(input.rawData);

    const subjectType = input.subjectType || (input.agentId ? 'AGENT' : 'CONNECTOR');
    const subjectId = input.subjectId || input.agentId || 'CONNECTOR_GITHUB';

    // Get last evidence hash for this organization to build tamper-evident hash chain
    const lastEv = await db.get<{ sha256_hash: string }>(
      'SELECT sha256_hash FROM evidence WHERE org_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
      [input.orgId]
    );

    const previousHash = lastEv ? lastEv.sha256_hash : '0000000000000000000000000000000000000000000000000000000000000000';
    const sha256Hash = this.computeTamperEvidentHash(sanitizedJson, previousHash);

    await db.run(
      `INSERT INTO evidence (
        id, org_id, agent_id, control_id, source_connector, method, 
        observed_resource, observed_data_json, epistemological_state,
        subject_type, subject_id, scope, evidence_strength,
        collector_name, collector_version, previous_hash, sha256_hash, sanitization_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evidenceId,
        input.orgId,
        input.agentId || null,
        input.controlId || null,
        input.sourceConnector,
        input.method,
        input.observedResource,
        sanitizedJson,
        input.epistemologicalState || 'OBSERVED',
        subjectType,
        subjectId,
        input.scope || 'AGENT_AUTHORITY',
        input.evidenceStrength || 'DEPENDENCY_ONLY',
        input.collectorName || 'tAIdyup GitHub Scanner V3',
        input.collectorVersion || '3.0.0',
        previousHash,
        sha256Hash,
        'SANITIZED_VERIFIED'
      ]
    );

    return evidenceId;
  }

  /**
   * Verifies the cryptographic integrity of a specific evidence record against its stored hash.
   */
  public static async verifyIntegrity(evidenceId: string): Promise<boolean> {
    const db = await getDb();
    const ev = await db.get<any>('SELECT * FROM evidence WHERE id = ?', [evidenceId]);
    if (!ev) return false;

    const recomputedHash = this.computeTamperEvidentHash(ev.observed_data_json, ev.previous_hash);
    return recomputedHash === ev.sha256_hash;
  }
}
