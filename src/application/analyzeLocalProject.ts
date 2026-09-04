import fs from 'fs';
import path from 'path';
import { ScannerCore } from '../scanner/scannerCore.js';
import { AIEstateScanResult } from '../scanner/types.js';
import { ManifestParser } from '../trust-kernel/manifestParser.js';
import { ReconciliationEngine } from '../trust-kernel/reconciliationEngine.js';
import { ScannerAdapter } from '../trust-kernel/scannerAdapter.js';
import { Claim, Evidence, ReconciledTrustState } from '../trust-kernel/types.js';

export type ProjectAnalysisErrorCode =
  | 'REMOTE_TARGET_NOT_SUPPORTED'
  | 'TARGET_NOT_FOUND'
  | 'TARGET_NOT_DIRECTORY'
  | 'MANIFEST_NOT_FOUND'
  | 'MANIFEST_INVALID_JSON'
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
    status: 'DECLARED';
    path: string;
  };
  scan: AIEstateScanResult;
  subjects: string[];
  declaredClaims: Claim[];
  observedClaims: Claim[];
  evidence: Evidence[];
  reconciliation: ReconciledTrustState;
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
  if (!fs.statSync(resolvedTarget).isDirectory()) {
    throw new ProjectAnalysisError('TARGET_NOT_DIRECTORY', `Local target is not a directory: \`${resolvedTarget}\`.`);
  }
  return resolvedTarget;
}

export async function analyzeLocalProject(targetPath: string): Promise<LocalProjectAnalysis> {
  const resolvedTarget = validateLocalProjectTarget(targetPath);
  const jsonManifestPath = path.join(resolvedTarget, 'taidyup.json');
  const yamlManifestPath = path.join(resolvedTarget, 'taidyup.yaml');
  const manifestPath = fs.existsSync(jsonManifestPath)
    ? jsonManifestPath
    : fs.existsSync(yamlManifestPath)
      ? yamlManifestPath
      : undefined;

  if (!manifestPath) {
    throw new ProjectAnalysisError(
      'MANIFEST_NOT_FOUND',
      `Manifest file \`taidyup.json\` or \`taidyup.yaml\` not found in \`${resolvedTarget}\`.`
    );
  }

  let manifestData: any;
  try {
    manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (error: any) {
    throw new ProjectAnalysisError('MANIFEST_INVALID_JSON', `Manifest Schema Error in \`${manifestPath}\`: ${error.message}`);
  }

  const parsedManifest = ManifestParser.parseManifest(manifestData, manifestPath);
  if (!parsedManifest.isValid) {
    throw new ProjectAnalysisError('MANIFEST_SCHEMA_INVALID', 'Manifest Validation Errors', parsedManifest.errors);
  }

  const scan = await ScannerCore.scanRepository(resolvedTarget);
  const scannerOutput = ScannerAdapter.adaptScanResult(scan);
  const reconciliation = ReconciliationEngine.reconcile(
    [...parsedManifest.claims, ...scannerOutput.claims],
    [...parsedManifest.evidences, ...scannerOutput.evidences]
  );
  const evidence = [...parsedManifest.evidences, ...scannerOutput.evidences];

  return {
    project: { name: manifestData.project, targetPath: resolvedTarget },
    manifest: { status: 'DECLARED', path: manifestPath },
    scan,
    subjects: Array.from(new Set(reconciliation.reconciledClaims.map(claim => claim.subject))),
    declaredClaims: parsedManifest.claims,
    observedClaims: scannerOutput.claims,
    evidence,
    reconciliation
  };
}
