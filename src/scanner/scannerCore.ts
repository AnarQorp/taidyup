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

function executableCode(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, ' ');
}

interface SourceUnit {
  relativePath: string;
  code: string;
}

interface StructuralCapability {
  action: CapabilityAction;
  resource: string;
  file: string;
  relationship: string;
  functionName: string;
}

function pythonFunctionBodies(code: string): Array<{ name: string; parameters: string[]; body: string }> {
  const lines = code.split(/\r?\n/);
  const functions: Array<{ name: string; parameters: string[]; body: string }> = [];
  for (let index = 0; index < lines.length; index++) {
    const start = lines[index].match(/^(\s*)def\s+(\w+)\s*\(/);
    if (!start) continue;
    let signature = lines[index];
    let signatureEnd = index;
    while (!/\)\s*(?:->[^:]*)?:\s*$/.test(signature) && signatureEnd + 1 < lines.length) {
      signature += `\n${lines[++signatureEnd]}`;
    }
    const parametersMatch = signature.match(/\(([\s\S]*?)\)\s*(?:->[^:]*)?:\s*$/);
    if (!parametersMatch) continue;
    const indentation = start[1].length;
    const body: string[] = [];
    for (let cursor = signatureEnd + 1; cursor < lines.length; cursor++) {
      const line = lines[cursor];
      if (line.trim() && line.match(/^\s*/)?.[0].length! <= indentation) break;
      body.push(line);
    }
    functions.push({
      name: start[2],
      parameters: parametersMatch[1].split(',').map(value => value.trim().split(/[:=]/)[0].trim()).filter(Boolean),
      body: body.join('\n')
    });
  }
  return functions;
}

function pythonClassBodies(code: string): Array<{ name: string; body: string }> {
  const lines = code.split(/\r?\n/);
  const classes: Array<{ name: string; body: string }> = [];
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^(\s*)class\s+(\w+)\s*\([^)]*\)\s*:/);
    if (!match) continue;
    const indentation = match[1].length;
    const body: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor++) {
      const line = lines[cursor];
      if (line.trim() && line.match(/^\s*/)?.[0].length! <= indentation) break;
      body.push(line);
    }
    classes.push({ name: match[2], body: body.join('\n') });
  }
  return classes;
}

function structuralAnalysis(units: SourceUnit[]): {
  hasAgent: boolean;
  agentFiles: Set<string>;
  capabilities: StructuralCapability[];
  gateFiles: Set<string>;
} {
  const agentSymbols = new Set<string>();
  const agentFiles = new Set<string>();
  const executionFunctions = new Set<string>();
  const wrapperFunctions = new Map<string, { agentParameter: number; dataParameters: number[] }>();

  for (const unit of units) {
    for (const fn of pythonFunctionBodies(unit.code)) {
      if (/\.upload\s*\([^)]*\)\.run\s*\(/s.test(fn.body) || /\bexecution\w*\.run\s*\(/.test(fn.body)) {
        executionFunctions.add(fn.name);
      }
      const delegated = fn.body.match(/\b(\w+)\.(?:init|initialize|improve)\s*\(([^)]*)\)/s);
      if (delegated) {
        const agentParameter = fn.parameters.indexOf(delegated[1]);
        const delegatedArguments = delegated[2].split(',').map(value => value.trim());
        const dataParameters = fn.parameters
          .map((parameter, index) => delegatedArguments.includes(parameter) && index !== agentParameter ? index : -1)
          .filter(index => index >= 0);
        if (agentParameter >= 0 && dataParameters.length > 0) wrapperFunctions.set(fn.name, { agentParameter, dataParameters });
      }
    }

    for (const pythonClass of pythonClassBodies(unit.code)) {
      const exposesTaskMethod = /def\s+(?:init|initialize|improve)\s*\([^)]*(?:prompt|task)[^)]*\)/.test(pythonClass.body);
      const composesModel = /self\.(?:ai|model|llm)\b|self\.\w*(?:gen|model|completion)\w*_fn\b/.test(pythonClass.body);
      const invokesModelOrGenerator = /self\.(?:ai|model|llm)\.\w+\s*\(|self\.\w*(?:gen|model|completion)\w*_fn\s*\(/.test(pythonClass.body);
      if (exposesTaskMethod && composesModel && invokesModelOrGenerator) {
        agentSymbols.add(pythonClass.name);
        agentFiles.add(unit.relativePath);
      }
    }
  }

  const receiverNames = new Set<string>();
  const reachableAgentFiles = new Set<string>();
  for (const unit of units) {
    for (const symbol of agentSymbols) {
      const construction = new RegExp(`\\b(\\w+)\\s*=\\s*${symbol}(?:\\.\\w+)?\\s*\\(`, 'g');
      for (const match of unit.code.matchAll(construction)) {
        const receiver = match[1];
        if (new RegExp(`\\b${receiver}\\.(?:init|initialize|improve)\\s*\\(`).test(unit.code) ||
            Array.from(wrapperFunctions.keys()).some(wrapper => new RegExp(`\\b${wrapper}\\s*\\([^)]*\\b${receiver}\\b`, 's').test(unit.code))) {
          receiverNames.add(receiver);
          reachableAgentFiles.add(unit.relativePath);
        }
      }
    }
  }

  const hasAgent = agentSymbols.size > 0 && receiverNames.size > 0;
  const capabilities: StructuralCapability[] = [];
  const gateFiles = new Set<string>();
  if (!hasAgent) return { hasAgent, agentFiles, capabilities, gateFiles };

  for (const unit of units) {
    const scopes = pythonFunctionBodies(unit.code).map(fn => fn.body);
    if (scopes.length === 0) scopes.push(unit.code);
    for (const scope of scopes) {
      const derived = new Set<string>();
      const readVariables = new Set<string>();
      for (const match of scope.matchAll(/^\s*(?:\(\s*)?(\w+)(?:\s*,[^=]*)?\)?\s*=\s*[^\n]*\.(?:read\w*|ask_for_files)\s*\(/gm)) readVariables.add(match[1]);
      for (const receiver of receiverNames) {
        const output = new RegExp(`\\b(\\w+)\\s*=\\s*${receiver}\\.(?:init|initialize|improve)\\s*\\(([^)]*)\\)`, 'g');
        for (const match of scope.matchAll(output)) {
          derived.add(match[1]);
          for (const readVariable of readVariables) {
            if (new RegExp(`\\b${readVariable}\\b`).test(match[2])) {
              capabilities.push({ action: 'READ', resource: 'Selected Project Files', file: unit.relativePath, relationship: `${readVariable} -> ${receiver} input`, functionName: 'read-to-agent' });
            }
          }
        }
      }
      for (const [wrapper, summary] of wrapperFunctions) {
        const call = new RegExp(`\\b(\\w+)\\s*=\\s*${wrapper}\\s*\\(([^)]*)\\)`, 'g');
        for (const match of scope.matchAll(call)) {
          const args = match[2].split(',').map(value => value.trim());
          if (receiverNames.has(args[summary.agentParameter])) {
            derived.add(match[1]);
            const readArgument = summary.dataParameters.map(index => args[index]).find(argument => readVariables.has(argument));
            if (readArgument) capabilities.push({ action: 'READ', resource: 'Selected Project Files', file: unit.relativePath, relationship: `${readArgument} -> ${wrapper} -> agent input`, functionName: wrapper });
          }
        }
      }

      for (const variable of derived) {
        const writeSink = new RegExp(`\\.\\w*(?:push|write_files|save_files|persist)\\w*\\s*\\(\\s*${variable}\\b`);
        if (writeSink.test(scope)) capabilities.push({ action: 'WRITE', resource: 'Generated / Selected Project Files', file: unit.relativePath, relationship: `agent output ${variable} -> persistence sink`, functionName: 'agent-output-write' });
        const executeSink = new RegExp(`\\.upload\\s*\\(\\s*${variable}\\s*\\)\\.run\\s*\\(`);
        if (executeSink.test(scope)) {
          capabilities.push({ action: 'EXECUTE', resource: 'Generated Entrypoint', file: unit.relativePath, relationship: `agent output ${variable} -> execution sink`, functionName: 'agent-output-execute' });
          if (/\b(?:confirm|input)\s*\(/.test(scope)) gateFiles.add(unit.relativePath);
        }
      }
    }
  }

  // Resolve an injected processor only when its default names a function whose body is an execution sink,
  // and the processor consumes a value produced by the component's generator.
  for (const unit of units) {
    for (const executionFunction of executionFunctions) {
      const defaultBinding = new RegExp(`\\b(\\w+_fn)\\s*(?::[^=,)]*)?=\\s*${executionFunction}\\b`).exec(unit.code);
      if (!defaultBinding) continue;
      const property = defaultBinding[1];
      const produced = /\b(\w+)\s*=\s*self\.\w*(?:gen|model|completion)\w*_fn\s*\(/.exec(unit.code)?.[1];
      if (produced && new RegExp(`self\\.${property}\\s*\\([^)]*\\b${produced}\\b`, 's').test(unit.code)) {
        capabilities.push({ action: 'EXECUTE', resource: 'Generated Entrypoint', file: unit.relativePath, relationship: `agent output ${produced} -> injected ${executionFunction} sink`, functionName: executionFunction });
        const sinkUnit = units.find(candidate => new RegExp(`def\\s+${executionFunction}\\s*\\(`).test(candidate.code));
        if (sinkUnit && /\b(?:confirm|input)\s*\(/.test(sinkUnit.code)) gateFiles.add(sinkUnit.relativePath);
      }
    }
  }

  return { hasAgent, agentFiles: new Set([...agentFiles, ...reachableAgentFiles]), capabilities, gateFiles };
}

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
    // Asset-level metadata must come from manifests owned by the scanned root.
    // Nested projects (tests, fixtures, benchmarks, generated examples, etc.) are
    // independent evidence scopes and cannot describe the root asset.
    const rootFiles = files.all.filter(f => path.dirname(f) === repoPath);
    const packageJsonFiles = rootFiles.filter(f => f.endsWith('package.json'));
    const pyprojectFiles = rootFiles.filter(f => f.endsWith('pyproject.toml') || f.endsWith('requirements.txt'));
    const mcpManifestFiles = rootFiles.filter(f => f.endsWith('mcp.json') || f.endsWith('.mcp'));

    let primaryAssetType: AssetType = 'UNKNOWN';
    const secondaryAssetTypes: AssetType[] = [];
    const positiveSignals: string[] = [];
    const negativeSignals: string[] = [];
    const sources: string[] = [];

    let detectedFramework = 'NONE';
    let detectedProvider = 'UNKNOWN';
    let detectedModel = 'UNKNOWN';
    let frameworkEvidence: { file: string } | undefined;
    let providerEvidence: { file: string } | undefined;
    let modelEvidence: { file: string } | undefined;

    let hasAgentConstruction = false;
    let hasAgentLoop = false;
    const agentLoopFiles = new Set<string>();
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
          frameworkEvidence = { file: relPath };
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
          frameworkEvidence = { file: relPath };
          hasAiDependency = true;
          secondaryAssetTypes.push('AUTOMATION_PLATFORM');
          positiveSignals.push(`AUTOMATION_PLATFORM_N8N: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('@google/agent-sdk')) {
          detectedFramework = 'Google ADK';
          frameworkEvidence = { file: relPath };
          hasAiDependency = true;
          positiveSignals.push(`GOOGLE_ADK_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('"langchain"') || content.includes('"@langchain/core"')) {
          hasAiDependency = true;
          if (!pFile.includes('devDependencies')) {
            detectedFramework = 'LangChain';
            frameworkEvidence = { file: relPath };
            positiveSignals.push(`LANGCHAIN_PROD_DEPENDENCY: ${relPath}`);
            sources.push(relPath);
          }
        }

        if (content.includes('@langchain/openai') || content.includes('openai')) {
          detectedProvider = 'OpenAI';
          detectedModel = 'gpt-4o';
          providerEvidence = { file: relPath };
          modelEvidence = { file: relPath };
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
          frameworkEvidence = { file: relPath };
          hasAiDependency = true;
          positiveSignals.push(`CREWAI_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('pyautogen') || content.includes('autogen')) {
          detectedFramework = 'AutoGen';
          frameworkEvidence = { file: relPath };
          hasAiDependency = true;
          positiveSignals.push(`AUTOGEN_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('semantic-kernel') || content.includes('semantic_kernel')) {
          detectedFramework = 'Semantic Kernel';
          frameworkEvidence = { file: relPath };
          hasAiDependency = true;
          positiveSignals.push(`SEMANTIC_KERNEL_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('llama-index') || content.includes('llama_index')) {
          detectedFramework = 'LlamaIndex';
          frameworkEvidence = { file: relPath };
          hasAiDependency = true;
          secondaryAssetTypes.push('RAG_SYSTEM');
          positiveSignals.push(`LLAMAINDEX_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('openai-agents')) {
          detectedFramework = 'OpenAI Agents SDK';
          frameworkEvidence = { file: relPath };
          hasAiDependency = true;
          positiveSignals.push(`OPENAI_AGENTS_SDK: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('babyagi')) {
          detectedFramework = 'BabyAGI';
          frameworkEvidence = { file: relPath };
          hasAiDependency = true;
          positiveSignals.push(`BABYAGI_DEPENDENCY: ${relPath}`);
          sources.push(relPath);
        } else if (content.includes('autogpt')) {
          detectedFramework = 'AutoGPT';
          frameworkEvidence = { file: relPath };
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
          providerEvidence = { file: relPath };
        }

        if (content.includes('mistralai')) {
          detectedProvider = 'Mistral';
          providerEvidence = { file: relPath };
        }
        if (content.includes('azure-openai')) {
          detectedProvider = 'Azure OpenAI';
          providerEvidence = { file: relPath };
        }
        if (content.includes('openai') && detectedProvider === 'UNKNOWN') {
          detectedProvider = 'OpenAI';
          providerEvidence = { file: relPath };
        }
      } catch (e) {}
    }

    const sourceUnits: SourceUnit[] = [];
    for (const prFile of files.prod) {
      if (!prFile.endsWith('.py') && !prFile.endsWith('.ts') && !prFile.endsWith('.js')) continue;
      try {
        sourceUnits.push({
          relativePath: path.relative(repoPath, prFile),
          code: executableCode(fs.readFileSync(prFile, 'utf-8'))
        });
      } catch (e) {}
    }

    // Inspect Production Source Code for Agent Construction & Binding
    for (const prFile of files.prod) {
      if (prFile.endsWith('.py') || prFile.endsWith('.ts') || prFile.endsWith('.js')) {
        try {
          const content = fs.readFileSync(prFile, 'utf-8');
          const code = executableCode(content);
          const relPath = path.relative(repoPath, prFile);

          const constructsAgent = /\b(?:StateGraph|AgentExecutor|Agent|Crew|UserProxyAgent|Kernel)\s*\(/.test(code);
          if (constructsAgent) {
            hasAgentConstruction = true;
            positiveSignals.push(`AGENT_CLASS_CONSTRUCTION: ${relPath}`);
            sources.push(relPath);
          }

          if (constructsAgent && /\.(?:run|kickoff|invoke)\s*\(/.test(code)) {
            hasAgentLoop = true;
            agentLoopFiles.add(prFile);
            positiveSignals.push(`AGENT_EXECUTION_LOOP: ${relPath}`);
          }

          if (/\bServer\s*\(/.test(code) && /\bListToolsRequestSchema\b/.test(code)) {
            hasMcpServer = true;
            positiveSignals.push(`MCP_SERVER_IMPLEMENTATION: ${relPath}`);
          }
        } catch (e) {}
      }
    }

    const structural = structuralAnalysis(sourceUnits);
    if (structural.hasAgent) {
      hasAgentConstruction = true;
      for (const file of structural.agentFiles) {
        positiveSignals.push(`STRUCTURAL_AGENT_COMPONENT: ${file}`);
        sources.push(file);
      }
      for (const file of structural.gateFiles) positiveSignals.push(`HUMAN_GATE_OBSERVED: ${file}`);
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
      primaryAssetType = 'UNKNOWN';
    }

    // Build Capabilities & Binding Graph
    const claims: CapabilityClaim[] = [];
    const bindingGraph: CapabilityBindingEdge[] = [];
    const unboundPotentialFunctionalities: Array<{ capability: CapabilityAction; resource: string; reason: string; file: string }> = [];

    for (const capability of structural.capabilities) {
      if (claims.some(claim => claim.action === capability.action && claim.provenance.file === capability.file)) continue;
      claims.push({
        subject: 'agent-primary',
        action: capability.action,
        resource: capability.resource,
        constraint: 'UNKNOWN',
        status: 'INFERRED',
        evidenceStrength: 'AGENT_BOUND',
        confidence: 0.85,
        provenance: {
          file: capability.file,
          snippet: capability.relationship
        }
      });
      bindingGraph.push({
        assetId: 'agent-primary',
        toolId: `structural-${capability.action.toLowerCase()}`,
        toolName: capability.relationship,
        functionName: capability.functionName,
        targetResource: capability.resource,
        capability: capability.action,
        evidenceStrength: 'AGENT_BOUND',
        confidence: 0.85,
        provenanceFile: capability.file
      });
      positiveSignals.push(`STRUCTURAL_${capability.action}_BINDING: ${capability.file} (${capability.relationship})`);
      sources.push(capability.file);
    }

    // Shell Check
    const shellFiles: string[] = [];
    for (const prFile of files.prod) {
      if (!prFile.endsWith('.py') && !prFile.endsWith('.ts') && !prFile.endsWith('.js')) continue;
      try {
        const content = fs.readFileSync(prFile, 'utf-8');
        const hasShellImport = /(?:from\s+['"]child_process['"]|require\(['"]child_process['"]\)|(?:from|import)\s+subprocess\b)/.test(content);
        if (hasShellImport) {
          shellFiles.push(prFile);
        }
      } catch (e) {}
    }

    const boundShellFile = shellFiles.find(file => agentLoopFiles.has(file));
    const unboundShellFile = shellFiles.find(file => file !== boundShellFile);
    if (boundShellFile) {
      const shellFile = path.relative(repoPath, boundShellFile);
      if (primaryAssetType === 'AGENT') {
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
      }
    }
    if (unboundShellFile) {
      unboundPotentialFunctionalities.push({
        capability: 'EXECUTE',
        resource: 'Terminal / OS Shell',
        reason: 'Shell execution utility present in code but NOT bound to an autonomous agent loop',
        file: path.relative(repoPath, unboundShellFile)
      });
    }

    const confidenceScore = primaryAssetType === 'UNKNOWN' ? 0 : primaryAssetType === 'AGENT' ? 0.95 : 0.90;

    const assetSignal: DiscoveredAssetSignal = {
      id: `asset-${crypto.createHash('md5').update(repoPath).digest('hex').substring(0, 8)}`,
      primaryAssetType,
      secondaryAssetTypes,
      name: `${path.basename(repoPath)} ${primaryAssetType}`,
      purpose: `Discovered ${primaryAssetType} in repository`,
      provider: detectedProvider,
      model: detectedModel,
      framework: detectedFramework,
      frameworkEvidence,
      providerEvidence,
      modelEvidence,
      protocols: hasMcpServer ? ['MCP (Model Context Protocol)'] : [],
      tools: boundShellFile && primaryAssetType === 'AGENT' ? [{ id: 'tool-shell', name: 'Shell Execution Tool', category: 'shell', evidenceStrength: 'AGENT_BOUND' }] : [],
      resources: [repoPath],
      credentialDependencies: detectedProvider !== 'UNKNOWN' ? [{ name: `${detectedProvider.toUpperCase()}_API_KEY`, type: 'API_KEY', provenanceFile: providerEvidence?.file || 'UNKNOWN' }] : [],
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
