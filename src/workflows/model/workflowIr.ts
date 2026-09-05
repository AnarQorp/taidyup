export type WorkflowRelation = 'CONTROL_FLOW_TO' | 'TOOL_OF' | 'MODEL_OF' | 'MEMORY_OF' | 'INPUT_TO' | 'OUTPUT_OF' | 'INVOKES_SUBWORKFLOW' | 'ERROR_TO';
export type ParameterClassification = 'LITERAL' | 'EXPRESSION' | 'REDACTED' | 'UNKNOWN';

export interface WorkflowLocator { provider: string; localId?: string; artifactHash: string; }
export interface ComponentLocator { provider: string; workflowLocalId?: string; localId: string; }
export interface ParameterFact { path: string; classification: ParameterClassification; sanitizedValueOrHash?: string; }
export interface CredentialReference { componentLocalId: string; type: string; referenceHash: string; status: 'REFERENCE_OBSERVED'; }

export interface WorkflowComponent {
  locator: ComponentLocator;
  displayName: string;
  kind: 'AGENT' | 'TOOL' | 'MODEL' | 'MEMORY' | 'SUBWORKFLOW' | 'TRIGGER' | 'UNMAPPED';
  providerType: string;
  providerTypeVersion: number;
  configuredOperation?: string;
  configuredResource?: string;
  enabledState: 'ENABLED_IN_EXPORT' | 'DISABLED';
  parameterFacts: ParameterFact[];
  dynamicFields: string[];
  credentialRefs: string[];
}

export interface WorkflowEdge {
  from: ComponentLocator;
  to: ComponentLocator;
  relation: WorkflowRelation;
  providerChannel: string;
  sourceIndex?: number;
  targetIndex?: number;
}

export interface WorkflowArtifact {
  provider: 'n8n';
  formatVersion?: string;
  artifactHash: string;
  workflowLocator: WorkflowLocator;
  displayName: string;
  observedState: 'EXPORTED_ACTIVE_TRUE' | 'EXPORTED_ACTIVE_FALSE' | 'EXPORTED_ACTIVE_ABSENT';
  components: WorkflowComponent[];
  edges: WorkflowEdge[];
  credentialReferences: CredentialReference[];
  sanitizedMetadata: { pinDataPresent: boolean; sourcePath: string; };
}
