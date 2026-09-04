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

export type DimensionAssessment = 'SATISFIED' | 'UNVERIFIED' | 'CONTRADICTED' | 'NOT_APPLICABLE';
export type ResourceRelation = 'EXACT' | 'NARROWER_THAN' | 'BROADER_THAN' | 'DISJOINT' | 'UNRESOLVED';
export type BindingAssessment = 'UNBOUND' | 'OWNER_ASSERTED' | 'EVIDENCE_BOUND' | 'STALE' | 'AMBIGUOUS';

export interface ResourceDescriptor {
  namespace: string;
  version: string;
  type: string;
  scope: string;
  artifact: string;
}

export interface ComponentLocator {
  scheme: string;
  version: string;
  revision: string;
  language: string;
  module: string;
  qualifiedSymbol: string;
  structuralFingerprint: string;
}

export interface SubjectBindingAssertion {
  declaredSubject: string;
  observedComponent: ComponentLocator;
  relation: 'REPRESENTED_BY' | 'IMPLEMENTS' | 'PART_OF';
  assertedBy: string;
}

export interface ClaimMatchAssessment {
  overall: EpistemicState;
  subject: DimensionAssessment;
  predicate: DimensionAssessment;
  action: DimensionAssessment;
  resource: DimensionAssessment;
  resourceRelation: ResourceRelation;
  constraints: Record<string, DimensionAssessment>;
  binding: BindingAssessment;
  evidenceRefs: string[];
  diagnostics: string[];
}

export interface ReconciliationOptions {
  subjectBindings?: SubjectBindingAssertion[];
}

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
  resourceDescriptor?: ResourceDescriptor;
  assessment?: ClaimMatchAssessment;
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
