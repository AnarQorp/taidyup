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

export type SnapshotCompleteness = 'COMPLETE' | 'PARTIAL' | 'UNKNOWN_COMPLETENESS';
export type SnapshotRetrievalStatus = 'SUCCESS' | 'ACCESS_DENIED' | 'UNAVAILABLE';
export type EvidenceObservation = 'PRESENCE' | 'ABSENCE_OBSERVED';

export type RuntimeEventKind = 'INVOCATION_ATTEMPTED' | 'EXECUTION_STARTED' | 'EXECUTION_COMPLETED' | 'RESULT_OBSERVED';
export type RuntimeOutcome = 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
export type RuntimeObservationCompleteness = 'PARTIAL_OBSERVATION' | 'COMPLETE_RUN_OBSERVATION' | 'BOUNDED_COMPLETE_OBSERVATION';
export type RuntimeBindingState = 'UNBOUND' | 'PARTIAL' | 'BOUND' | 'CONTRADICTED';
export type RuntimeBindingMethod = 'CONTEXTUAL' | 'STRUCTURAL' | 'SOURCE_ASSERTED' | 'ATTESTED';

export interface RuntimeDimensionBinding {
  state: RuntimeBindingState;
  method?: RuntimeBindingMethod;
  value?: string;
  evidence?: string;
  /** Inspectable reference to evidence established outside the runtime event. */
  evidenceRef?: string;
}

export interface RuntimeEvidenceData {
  schemaVersion: '0.1';
  eventKind: RuntimeEventKind;
  eventTime: string;
  operation: { action: CapabilityAction; resource?: string; constraints?: Record<string, string | number | boolean> };
  bindings: {
    subject: RuntimeDimensionBinding;
    action: RuntimeDimensionBinding;
    resource: RuntimeDimensionBinding;
    constraints: RuntimeDimensionBinding;
  };
  source: { kind: 'LOCAL_TOOL_WRAPPER' | 'IMPORTED_ARTIFACT'; identity: string };
  sourceEventId: string;
  observationScope: { kind: 'RUN' | 'WINDOW'; id: string; startedAt?: string; endedAt?: string };
  /** Import validation enforces PARTIAL_OBSERVATION in V0. */
  completeness: RuntimeObservationCompleteness;
  sanitization: { policy: 'ALLOWLIST_V0'; rawPayloadPersisted: false; droppedFields: string[] };
  outcome?: RuntimeOutcome;
  runId?: string;
  parentEventId?: string;
  eventHash?: string;
}

export interface RuntimeAssessment {
  observationState: 'NO_OBSERVATION' | 'ATTEMPT_OBSERVED' | 'START_OBSERVED' | 'COMPLETION_OBSERVED' | 'RESULT_OBSERVED';
  latestEvent?: RuntimeEventKind;
  latestOutcome?: RuntimeOutcome;
  observedCount: number;
  observedExecutionInstances?: number;
  observedEvents?: number;
  observationWindow?: { startedAt?: string; endedAt?: string };
  completeness: 'NO_OBSERVATION' | RuntimeObservationCompleteness;
  binding: RuntimeBindingState;
  evidenceRefs: string[];
  diagnostics: string[];
  lastObservedAt?: string;
}

export interface ConfigurationIdentity {
  sourceInstance: string;
  scope: string;
}

/** Provider-neutral point-in-time metadata; transport details remain outside the Kernel. */
export interface ConnectedSnapshotMetadata extends ConfigurationIdentity {
  mode: 'POINT_IN_TIME';
  completeness: SnapshotCompleteness;
  retrievalStatus: SnapshotRetrievalStatus;
  revision?: string;
}

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
  runtimeAssessment?: RuntimeAssessment;
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
  unboundRuntimeObservations?: Evidence[];
  /** Project-level declaration-source context; this does not alter capability epistemic states. */
  declarationContext?: {
    status: 'PRESENT' | 'ABSENT';
    path: string | null;
  };
}
