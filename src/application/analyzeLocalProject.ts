import fs from 'fs';
import path from 'path';
import { ScannerCore } from '../scanner/scannerCore.js';
import { AIEstateScanResult } from '../scanner/types.js';
import { ManifestParser } from '../trust-kernel/manifestParser.js';
import { ReconciliationEngine } from '../trust-kernel/reconciliationEngine.js';
import { ScannerAdapter } from '../trust-kernel/scannerAdapter.js';
import { Claim, Evidence, ReconciledTrustState } from '../trust-kernel/types.js';
import { importRuntimeArtifact } from '../runtime/runtimeEvidence.js';

export type ProjectAnalysisErrorCode =
  | 'REMOTE_TARGET_NOT_SUPPORTED'
  | 'TARGET_NOT_FOUND'
  | 'TARGET_NOT_DIRECTORY'
  | 'TARGET_READ_FAILED'
  | 'MANIFEST_READ_FAILED'
  | 'MANIFEST_INVALID_JSON'
  | 'MANIFEST_INVALID_SYNTAX'
  | 'MANIFEST_SCHEMA_INVALID';

export class ProjectAnalysisError extends Error {
  constructor(
    public readonly code: ProjectAnalysisErrorCode,
    message: string,
    public readonly details: string[] = []
  ) {
    super(message);
    this.name = 'ProjectAnalysisError';
  }
}

export interface LocalProjectAnalysis {
  project: {
    name: string;
    targetPath: string;
  };
  manifest: {
    status: 'DECLARED' | 'ABSENT';
    path: string | null;
  };
  scan: AIEstateScanResult;
  subjects: string[];
  declaredClaims: Claim[];
  observedClaims: Claim[];
  evidence: Evidence[];
  reconciliation: ReconciledTrustState;
  runtime?: { artifact: string; diagnostics: string[] };
}

export function validateLocalProjectTarget(targetPath: string): string {
  const isRemoteTarget = /^[a-z][a-z0-9+.-]*:\/\//i.test(targetPath) ||
    /^[^/@\s]+@[^:/\s]+:.+/.test(targetPath);
  if (isRemoteTarget) {
    throw new ProjectAnalysisError(
      'REMOTE_TARGET_NOT_SUPPORTED',
      `Remote URL or Git reference targets are not supported in tAIdyup Alpha: \`${targetPath}\`. Provide an existing local directory/workspace.`
    );
  }

  const resolvedTarget = path.resolve(targetPath);
  if (!fs.existsSync(resolvedTarget)) {
    throw new ProjectAnalysisError('TARGET_NOT_FOUND', `Local target does not exist: \`${resolvedTarget}\`.`);
  }
  try {
    if (!fs.statSync(resolvedTarget).isDirectory()) {
      throw new ProjectAnalysisError('TARGET_NOT_DIRECTORY', `Local target is not a directory: \`${resolvedTarget}\`.`);
    }
  } catch (error: any) {
    if (error instanceof ProjectAnalysisError) throw error;
    throw new ProjectAnalysisError('TARGET_READ_FAILED', `Local target metadata cannot be read: \`${resolvedTarget}\`: ${error.message}`);
  }
  return resolvedTarget;
}

export async function analyzeLocalProject(targetPath: string, options: { runtimeArtifactPath?: string } = {}): Promise<LocalProjectAnalysis> {
  const resolvedTarget = validateLocalProjectTarget(targetPath);
  try {
    fs.accessSync(resolvedTarget, fs.constants.R_OK);
    fs.readdirSync(resolvedTarget);
  } catch (error: any) {
    throw new ProjectAnalysisError('TARGET_READ_FAILED', `Local target cannot be inspected: \`${resolvedTarget}\`: ${error.message}`);
  }
  assertReadableScanInputs(resolvedTarget);
  const jsonManifestPath = path.join(resolvedTarget, 'taidyup.json');
  const yamlManifestPath = path.join(resolvedTarget, 'taidyup.yaml');
  const manifestPath = fs.existsSync(jsonManifestPath)
    ? jsonManifestPath
    : fs.existsSync(yamlManifestPath)
      ? yamlManifestPath
      : undefined;

  let manifestData: any;
  let parsedManifest = { isValid: true, errors: [] as string[], claims: [] as Claim[], evidences: [] as Evidence[] };
  if (manifestPath) {
    let source: string;
    try { source = fs.readFileSync(manifestPath, 'utf-8'); }
    catch (error: any) { throw new ProjectAnalysisError('MANIFEST_READ_FAILED', `Declaration manifest cannot be read: \`${manifestPath}\`: ${error.message}`); }
    try { manifestData = JSON.parse(source); }
    catch (error: any) {
      const code = manifestPath.endsWith('.json') ? 'MANIFEST_INVALID_JSON' : 'MANIFEST_INVALID_SYNTAX';
      throw new ProjectAnalysisError(code, `Declaration manifest syntax is invalid in \`${manifestPath}\`: ${error.message}`);
    }
    parsedManifest = ManifestParser.parseManifest(manifestData, manifestPath);
    if (!parsedManifest.isValid) throw new ProjectAnalysisError('MANIFEST_SCHEMA_INVALID', 'Manifest Validation Errors', parsedManifest.errors);
  }

  const scan = await ScannerCore.scanRepository(resolvedTarget);
  const scannerOutput = ScannerAdapter.adaptScanResult(scan);
  const runtime = options.runtimeArtifactPath ? importRuntimeArtifact(options.runtimeArtifactPath) : undefined;
  const reconciliation: ReconciledTrustState = {
    ...ReconciliationEngine.reconcile(
    [...parsedManifest.claims, ...scannerOutput.claims],
    [...parsedManifest.evidences, ...scannerOutput.evidences, ...(runtime?.evidences || [])]
    ),
    declarationContext: { status: manifestPath ? 'PRESENT' : 'ABSENT', path: manifestPath ?? null }
  };
  const evidence = [...parsedManifest.evidences, ...scannerOutput.evidences, ...(runtime?.evidences || [])];

  return {
    project: { name: manifestPath ? manifestData.project : deriveProjectName(resolvedTarget), targetPath: resolvedTarget },
    manifest: manifestPath ? { status: 'DECLARED', path: manifestPath } : { status: 'ABSENT', path: null },
    scan,
    subjects: Array.from(new Set(reconciliation.reconciledClaims.map(claim => claim.subject))),
    declaredClaims: parsedManifest.claims,
    observedClaims: scannerOutput.claims,
    evidence,
    reconciliation,
    runtime: options.runtimeArtifactPath ? { artifact: path.basename(options.runtimeArtifactPath), diagnostics: runtime?.diagnostics || [] } : undefined
  };
}

function deriveProjectName(targetPath: string): string {
  const packagePath = path.join(targetPath, 'package.json');
  if (fs.existsSync(packagePath)) {
    try {
      const value = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))?.name;
      if (typeof value === 'string' && value.trim()) return value.trim();
    } catch {
      // Package metadata is convenience-only; scanner evidence and project analysis remain independent.
    }
  }
  return path.basename(targetPath);
}

function assertReadableScanInputs(root: string): void {
  const excluded = new Set(['node_modules', '.git', 'dist', 'build']);
  const inspect = (dir: string, depth: number): void => {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (error: any) { throw new ProjectAnalysisError('TARGET_READ_FAILED', `Project directory cannot be inspected: \`${dir}\`: ${error.message}`); }
    for (const entry of entries) {
      if (excluded.has(entry.name)) continue;
      const candidate = path.join(dir, entry.name);
      if (entry.isDirectory()) { inspect(candidate, depth + 1); continue; }
      if (!/\.(?:py|ts|js|json|toml|txt|mcp)$/.test(entry.name)) continue;
      try { fs.accessSync(candidate, fs.constants.R_OK); }
      catch (error: any) { throw new ProjectAnalysisError('TARGET_READ_FAILED', `Project input cannot be read: \`${candidate}\`: ${error.message}`); }
    }
  };
  inspect(root, 0);
}
