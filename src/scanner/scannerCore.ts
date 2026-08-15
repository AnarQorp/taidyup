import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AIEstateScanResult,
  AssetType,
  CapabilityAction,
  CapabilityBindingEdge,
  CapabilityClaim,
  DiscoveredAssetSignal,
  EvidenceStrength
} from './types.js';

export class ScannerCore {
  public static SCANNER_VERSION = '4.0.0-open-core';

  /**
   * Pure, deterministic, zero-dependency repository scanner.
   * Input: Repository filesystem path.
   * Output: Structured AIEstateScanResult.
   */
  public static async scanRepository(repoPath: string): Promise<AIEstateScanResult> {
    const timestamp = new Date().toISOString();

    const walkFiles = (dir: string, maxDepth = 4, currentDepth = 0): { all: string[]; prod: string[]; tests: string[] } => {
      let all: string[] = [];
      let prod: string[] = [];
      let tests: string[] = [];

      if (currentDepth > maxDepth || !fs.existsSync(dir)) return { all, prod, tests };
      try {
        const list = fs.readdirSync(dir);
        for (const file of list) {
          if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'build') continue;
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat && stat.isDirectory()) {
            const res = walkFiles(filePath, maxDepth, currentDepth + 1);
            all = all.concat(res.all);
            prod = prod.concat(res.prod);
            tests = tests.concat(res.tests);
          } else {
            all.push(filePath);
            if (filePath.includes('/tests/') || filePath.includes('/test/') || filePath.endsWith('.test.js') || filePath.endsWith('.test.ts')) {
              tests.push(filePath);
            } else {
              prod.push(filePath);
            }
          }
        }
      } catch (e) {}
      return { all, prod, tests };
    };

    const files = walkFiles(repoPath);

    // Collect manifests and source files
    const packageJsonFiles = files.all.filter(f => f.endsWith('package.json'));
    const pyprojectFiles = files.all.filter(f => f.endsWith('pyproject.toml') || f.endsWith('requirements.txt'));
    const mcpManifestFiles = files.all.filter(f => f.endsWith('mcp.json') || f.endsWith('.mcp'));

    let primaryAssetType: AssetType = 'UNKNOWN';
    const secondaryAssetTypes: AssetType[] = [];
    const positiveSignals: string[] = [];
    const negativeSignals: string[] = [];
    const sources: string[] = [];

    let detectedFramework = 'NONE';
    let detectedProvider = 'UNKNOWN';
    let detectedModel = 'UNKNOWN';

    let hasAgentConstruction = false;
    let hasAgentLoop = false;
    let hasMcpServer = false;
    let hasVectorStore = false;
    let hasAiDependency = false;
    let isPureUiOrNonAi = false;

    // Check Package.json
    for (const pFile of packageJsonFiles) {
      try {
        const content = fs.readFileSync(pFile, 'utf-8');
        const relPath = path.relative(repoPath, pFile);

        if (content.includes('"name": "react"') || content.includes('"name": "express"')) {
          isPureUiOrNonAi = true;
          negativeSignals.push(`CONVENTIONAL_NON_AI_LIBRARY: ${relPath}`);
        }

        if (content.includes('@langchain/langgraph')) {
          detectedFramework = 'LangGraph';
          hasAiDependency = true;
          positiveSignals.push(`FRAMEWORK_DEPENDENCY_LANGGRAPH: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('@modelcontextprotocol/sdk')) {
          hasMcpServer = true;
          hasAiDependency = true;
          secondaryAssetTypes.push('MCP_SERVER');
          positiveSignals.push(`MCP_SDK_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('n8n-nodes-langchain') || content.includes('n8n-workflow')) {
          detectedFramework = 'n8n Workflow Engine';
          hasAiDependency = true;
          secondaryAssetTypes.push('AUTOMATION_PLATFORM');
          positiveSignals.push(`AUTOMATION_PLATFORM_N8N: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('@google/agent-sdk')) {
          detectedFramework = 'Google ADK';
          hasAiDependency = true;
          positiveSignals.push(`GOOGLE_ADK_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('"langchain"') || content.includes('"@langchain/core"')) {
          hasAiDependency = true;
          if (!pFile.includes('devDependencies')) {
            detectedFramework = 'LangChain';
            positiveSignals.push(`LANGCHAIN_PROD_DEPENDENCY: ${relPath}`);
            sources.push(relPath);
          }
        }

        if (content.includes('@langchain/openai') || content.includes('openai')) {
          detectedProvider = 'OpenAI';
          detectedModel = 'gpt-4o';
        }
      } catch (e) {}
    }

    // Check Python Manifests
    for (const pyFile of pyprojectFiles) {
      try {
        const content = fs.readFileSync(pyFile, 'utf-8');
        const relPath = path.relative(repoPath, pyFile);

        if (content.includes('crewai')) {
          detectedFramework = 'CrewAI';
          hasAiDependency = true;
          positiveSignals.push(`CREWAI_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('pyautogen') || content.includes('autogen')) {
          detectedFramework = 'AutoGen';
          hasAiDependency = true;
          positiveSignals.push(`AUTOGEN_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('semantic-kernel') || content.includes('semantic_kernel')) {
          detectedFramework = 'Semantic Kernel';
          hasAiDependency = true;
          positiveSignals.push(`SEMANTIC_KERNEL_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('llama-index') || content.includes('llama_index')) {
          detectedFramework = 'LlamaIndex';
          hasAiDependency = true;
          secondaryAssetTypes.push('RAG_SYSTEM');
          positiveSignals.push(`LLAMAINDEX_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('openai-agents')) {
          detectedFramework = 'OpenAI Agents SDK';
          hasAiDependency = true;
          positiveSignals.push(`OPENAI_AGENTS_SDK: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('babyagi')) {
          detectedFramework = 'BabyAGI';
          hasAiDependency = true;
          positiveSignals.push(`BABYAGI_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('autogpt')) {
          detectedFramework = 'AutoGPT';
          hasAiDependency = true;
          positiveSignals.push(`AUTOGPT_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('chromadb') || content.includes('chroma')) {
          hasVectorStore = true;
          secondaryAssetTypes.push('VECTOR_STORE');
          positiveSignals.push(`VECTOR_STORE_CHROMA: ${relPath}`);
        } else if (content.includes('anthropic')) {
          hasAiDependency = true;
          detectedProvider = 'Anthropic';
        }

        if (content.includes('mistralai')) detectedProvider = 'Mistral';
        if (content.includes('azure-openai')) detectedProvider = 'Azure OpenAI';
        if (content.includes('openai') && detectedProvider === 'UNKNOWN') detectedProvider = 'OpenAI';
      } catch (e) {}
    }

    // Inspect Production Source Code for Agent Construction & Binding
    for (const prFile of files.prod) {
      if (prFile.endsWith('.py') || prFile.endsWith('.ts') || prFile.endsWith('.js')) {
        try {
          const content = fs.readFileSync(prFile, 'utf-8');
          const relPath = path.relative(repoPath, prFile);

          if (content.includes('StateGraph') || content.includes('AgentExecutor') || content.includes('Agent(') || content.includes('Crew(') || content.includes('UserProxyAgent(') || content.includes('Kernel(')) {
            hasAgentConstruction = true;
            positiveSignals.push(`AGENT_CLASS_CONSTRUCTION: ${relPath}`);
            sources.push(relPath);
          }

          if (content.includes('.run(') || content.includes('.kickoff(') || content.includes('.invoke(') || content.includes('babyagi.py') || content.includes('cli.py')) {
            hasAgentLoop = true;
            positiveSignals.push(`AGENT_EXECUTION_LOOP: ${relPath}`);
          }

          if (content.includes('Server(') && content.includes('ListToolsRequestSchema')) {
            hasMcpServer = true;
            positiveSignals.push(`MCP_SERVER_IMPLEMENTATION: ${relPath}`);
          }
        } catch (e) {}
      }
    }

    // SEMANTIC ASSET CLASSIFICATION
    if (isPureUiOrNonAi && !hasAiDependency && !hasAgentConstruction) {
      primaryAssetType = 'NON_AI';
    } else if (hasMcpServer && !hasAgentConstruction && !hasAgentLoop) {
      primaryAssetType = 'MCP_SERVER';
      negativeSignals.push('MCP_SERVER_WITHOUT_AUTONOMOUS_AGENT_LOOP');
    } else if (hasVectorStore && !hasAgentConstruction && !hasAgentLoop) {
      primaryAssetType = 'VECTOR_STORE';
      negativeSignals.push('VECTOR_STORE_INFRASTRUCTURE_WITHOUT_AGENT');
    } else if (hasAiDependency && !hasAgentConstruction && !hasAgentLoop) {
      primaryAssetType = 'SDK_LIBRARY';
      negativeSignals.push('AI_SDK_LIBRARY_DEPENDENCY_WITHOUT_AGENT_CONSTRUCTION');
    } else if (hasAgentConstruction || hasAgentLoop) {
      primaryAssetType = 'AGENT';
    } else {
      primaryAssetType = 'NON_AI';
    }

    // Build Capabilities & Binding Graph
    const claims: CapabilityClaim[] = [];
    const bindingGraph: CapabilityBindingEdge[] = [];
    const unboundPotentialFunctionalities: Array<{ capability: CapabilityAction; resource: string; reason: string; file: string }> = [];

    // Shell Check
    let hasShellCode = false;
    let shellFile = '';
    for (const prFile of files.prod) {
      try {
        const content = fs.readFileSync(prFile, 'utf-8');
        if (content.includes('subprocess') || content.includes('child_process')) {
          hasShellCode = true;
          shellFile = path.relative(repoPath, prFile);
          break;
        }
      } catch (e) {}
    }

    if (hasShellCode) {
      if (primaryAssetType === 'AGENT' && hasAgentConstruction) {
        // Bound to Agent!
        claims.push({
          subject: 'agent-primary',
          action: 'EXECUTE',
          resource: 'Terminal / OS Shell',
          constraint: 'UNKNOWN',
          status: 'INFERRED',
          evidenceStrength: 'AGENT_BOUND',
          confidence: 0.90,
          provenance: { file: shellFile }
        });
        bindingGraph.push({
          assetId: 'agent-primary',
          toolId: 'tool-shell',
          toolName: 'Shell Execution Tool',
          functionName: 'exec',
          targetResource: 'OS Shell',
          capability: 'EXECUTE',
          evidenceStrength: 'AGENT_BOUND',
          confidence: 0.90,
          provenanceFile: shellFile
        });
      } else {
        // Record as UNBOUND POTENTIAL FUNCTIONALITY (Prevent Critical FP!)
        unboundPotentialFunctionalities.push({
          capability: 'EXECUTE',
          resource: 'Terminal / OS Shell',
          reason: 'Shell execution utility present in code but NOT bound to an autonomous agent loop',
          file: shellFile
        });
      }
    }

    // Default Read Capability
    claims.push({
      subject: primaryAssetType === 'AGENT' ? 'agent-primary' : 'asset-primary',
      action: 'READ',
      resource: 'Repository / Workspace Code',
      constraint: 'read-only',
      status: 'OBSERVED',
      evidenceStrength: 'DEPENDENCY_ONLY',
      confidence: 0.95,
      provenance: { file: sources[0] || 'package.json' }
    });

    const confidenceScore = primaryAssetType === 'AGENT' ? 0.95 : 0.90;

    const assetSignal: DiscoveredAssetSignal = {
      id: `asset-${crypto.createHash('md5').update(repoPath).digest('hex').substring(0, 8)}`,
      primaryAssetType,
      secondaryAssetTypes,
      name: `${path.basename(repoPath)} ${primaryAssetType}`,
      purpose: `Discovered ${primaryAssetType} in repository`,
      provider: detectedProvider,
      model: detectedModel,
      framework: detectedFramework,
      protocols: hasMcpServer ? ['MCP (Model Context Protocol)'] : [],
      tools: hasShellCode && primaryAssetType === 'AGENT' ? [{ id: 'tool-shell', name: 'Shell Execution Tool', category: 'shell', evidenceStrength: 'AGENT_BOUND' }] : [],
      resources: [repoPath],
      credentialDependencies: detectedProvider !== 'UNKNOWN' ? [{ name: `${detectedProvider.toUpperCase()}_API_KEY`, type: 'API_KEY', provenanceFile: sources[0] || 'manifest' }] : [],
      capabilities: claims,
      bindingGraph,
      humanOversight: 'UNKNOWN',
      revocation: 'NOT_OBSERVED',
      provenance: {
        signal: 'Open Core Scanner Core V4',
        sources: Array.from(new Set(sources)),
        positiveSignals,
        negativeSignals,
        confidence: confidenceScore
      }
    };

    return {
      scannerVersion: this.SCANNER_VERSION,
      scannedPath: repoPath,
      timestamp,
      summary: {
        totalAssets: 1,
        agentCount: primaryAssetType === 'AGENT' ? 1 : 0,
        mcpServerCount: primaryAssetType === 'MCP_SERVER' ? 1 : 0,
        vectorStoreCount: primaryAssetType === 'VECTOR_STORE' ? 1 : 0,
        sdkLibraryCount: primaryAssetType === 'SDK_LIBRARY' ? 1 : 0,
        nonAiCount: primaryAssetType === 'NON_AI' ? 1 : 0
      },
      assets: [assetSignal],
      potentialFunctionalitiesNotBound: unboundPotentialFunctionalities
    };
  }
}
