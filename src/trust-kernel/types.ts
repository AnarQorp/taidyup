export type Predicate = 'CAN' | 'MUST' | 'CANNOT';

export type CapabilityAction = 
  | 'READ'
  | 'WRITE'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'EXECUTE'
  | 'SEND'
  | 'PUBLISH'
  | 'APPROVE'
  | 'PURCHASE'
  | 'TRANSFER'
  | 'ADMIN';

export type SourceType = 'DECLARATION' | 'STATIC' | 'CONNECTED' | 'RUNTIME' | 'HUMAN_REVIEW';

export type EpistemicState = 
  | 'DECLARED'
  | 'OBSERVED'
  | 'INFERRED'
  | 'SUPPORTED'
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'CONFLICT'
  | 'NOT_OBSERVED'
  | 'UNDECLARED_OBSERVATION'
  | 'UNKNOWN';

export type EvidenceStrength = 
  | 'DEPENDENCY_ONLY'
  | 'IMPORT_OBSERVED'
  | 'FUNCTION_DEFINED'
  | 'TOOL_REGISTERED'
  | 'AGENT_BOUND'
  | 'ENTRYPOINT_REACHABLE'
  | 'RUNTIME_CONFIRMED';

export interface ProvenanceRecord {
  sourceType: SourceType;
  artifact: string;
  location?: string;
  snippet?: string;
  collectorId?: string;
  evidenceId?: string;
}

export interface Claim {
  id: string;
  subject: string;
  predicate: Predicate;
  action?: CapabilityAction;
  resource?: string;
  constraints?: Record<string, any>;
  source: SourceType;
  status: EpistemicState;
  confidence?: number;
  provenance: ProvenanceRecord[];
}

export interface Evidence {
  id: string;
  type: string;
  sourceType: SourceType;
  subject: string;
  observedAt: string;
  collectorId: string;
  collectorVersion: string;
  artifact: string;
  location?: string;
  data: any;
  strength: EvidenceStrength;
  sha256: string;
  provenance: {
    file: string;
    lineRange?: string;
  };
}

export type FindingType = 
  | 'DECLARATION_CONFLICT'
  | 'UNDECLARED_CRITICAL_CAPABILITY'
  | 'UNVERIFIED_CRITICAL_CLAIM'
  | 'MISSING_OWNER'
  | 'MISSING_OVERSIGHT_EVIDENCE'
  | 'MISSING_REVOCATION_EVIDENCE'
  | 'CROSS_SUBJECT_ATTEMPT'
  | 'STALE_EVIDENCE'
  | 'CREDENTIAL_EXPOSURE';

export interface TechnicalFinding {
  id: string;
  type: FindingType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  description: string;
  declaredText?: string;
  observedText?: string;
  evidenceRefs: string[];
  provenance: {
    file: string;
    location?: string;
  };
}

export interface ReconciledTrustState {
  schemaVersion: string;
  timestamp: string;
  summary: {
    totalClaims: number;
    supportedCount: number;
    unverifiedCount: number;
    conflictCount: number;
    undeclaredCount: number;
    unknownCount: number;
    criticalFindingsCount: number;
  };
  reconciledClaims: Claim[];
  findings: TechnicalFinding[];
}
