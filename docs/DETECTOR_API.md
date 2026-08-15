# TAIDYUP FRAMEWORK DETECTOR API SPECIFICATION

## Overview
tAIdyup allows community contributors to write framework detectors (e.g. for LangGraph, CrewAI, AutoGen, Semantic Kernel, n8n, MCP) to observe AI assets and tools.

---

## Detector Contract Interface

```typescript
export interface ScanContext {
  repoPath: string;
  files: string[];
}

export interface DiscoveredAssetSignal {
  id: string;
  name: string;
  primaryAssetType: string;
  framework?: string;
  provider?: string;
  tools: Array<{ name: string; category?: string }>;
  capabilities: Array<{
    action: string;
    resource: string;
    evidenceStrength: string;
    confidence: number;
    provenance: { file: string; lineRange?: string; snippet?: string };
  }>;
}

export interface TrustAgentDetector {
  id: string;
  name: string;
  supportedLanguages: string[];
  detect(context: ScanContext): Promise<DiscoveredAssetSignal[]>;
}
```

---

## Inviolable Rule
Detectors emit `DiscoveredAssetSignal[]` with evidence strength. **Detectors do NOT set final epistemic states.** The central Reconciliation Engine processes all detector signals uniformly.
