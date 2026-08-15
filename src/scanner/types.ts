export type AssetType = 
  | 'AGENT'
  | 'AGENT_RUNTIME'
  | 'AGENT_FRAMEWORK'
  | 'AI_APPLICATION'
  | 'CHATBOT'
  | 'RAG_SYSTEM'
  | 'MCP_SERVER'
  | 'MCP_CLIENT'
  | 'TOOL_SERVER'
  | 'MODEL_PROVIDER'
  | 'MODEL_RUNTIME'
  | 'VECTOR_STORE'
  | 'SDK_LIBRARY'
  | 'ORCHESTRATOR'
  | 'AUTOMATION_PLATFORM'
  | 'AI_INFRASTRUCTURE'
  | 'NON_AI'
  | 'UNKNOWN';

export type EvidenceStrength = 
  | 'DEPENDENCY_ONLY'
  | 'IMPORT_OBSERVED'
  | 'FUNCTION_DEFINED'
  | 'TOOL_REGISTERED'
  | 'AGENT_BOUND'
  | 'ENTRYPOINT_REACHABLE'
  | 'RUNTIME_CONFIRMED';

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

export interface CapabilityClaim {
  subject: string;
  action: CapabilityAction;
  resource: string;
  constraint: string;
  status: 'INFERRED' | 'OBSERVED' | 'DECLARED' | 'POTENTIAL_ONLY' | 'UNKNOWN';
  evidenceStrength: EvidenceStrength;
  confidence: number;
  provenance: {
    file: string;
    lineRange?: string;
    snippet?: string;
  };
}

export interface CapabilityBindingEdge {
  assetId: string;
  toolId: string;
  toolName: string;
  functionName: string;
  targetResource: string;
  capability: CapabilityAction;
  evidenceStrength: EvidenceStrength;
  confidence: number;
  provenanceFile: string;
}

export interface DiscoveredAssetSignal {
  id: string;
  primaryAssetType: AssetType;
  secondaryAssetTypes: AssetType[];
  name: string;
  purpose: string;
  provider: string;
  model: string;
  framework: string;
  protocols: string[];
  tools: Array<{ id: string; name: string; category: string; evidenceStrength: EvidenceStrength }>;
  resources: string[];
  credentialDependencies: Array<{ name: string; type: string; provenanceFile: string }>;
  capabilities: CapabilityClaim[];
  bindingGraph: CapabilityBindingEdge[];
  humanOversight: 'OBSERVED_PRESENT' | 'OBSERVED_ABSENT' | 'NOT_OBSERVED' | 'UNKNOWN';
  revocation: 'OBSERVED_PRESENT' | 'OBSERVED_ABSENT' | 'NOT_OBSERVED' | 'UNKNOWN';
  provenance: {
    signal: string;
    sources: string[];
    positiveSignals: string[];
    negativeSignals: string[];
    confidence: number;
  };
}

export interface AIEstateScanResult {
  scannerVersion: string;
  scannedPath: string;
  timestamp: string;
  summary: {
    totalAssets: number;
    agentCount: number;
    mcpServerCount: number;
    vectorStoreCount: number;
    sdkLibraryCount: number;
    nonAiCount: number;
  };
  assets: DiscoveredAssetSignal[];
  potentialFunctionalitiesNotBound: Array<{
    capability: CapabilityAction;
    resource: string;
    reason: string;
    file: string;
  }>;
}
