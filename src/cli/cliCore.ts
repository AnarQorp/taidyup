import fs from 'fs';
import path from 'path';
import { ScannerCore } from '../scanner/scannerCore.js';
import { ManifestParser } from '../trust-kernel/manifestParser.js';
import { ReportGenerator } from '../trust-kernel/reportGenerator.js';
import { SarifExporter } from './sarifExporter.js';
import { DiffEngine } from './diffEngine.js';
import {
  analyzeLocalProject,
  ProjectAnalysisError,
  validateLocalProjectTarget
} from '../application/analyzeLocalProject.js';
import { analyzeConnectedN8nWorkflow } from '../application/analyzeConnectedN8nWorkflow.js';
import { RuntimeArtifactError } from '../runtime/runtimeEvidence.js';

export interface CliOptions {
  command: string;
  targetPath: string;
  strict?: boolean;
  json?: boolean;
  accept?: boolean;
  outputFile?: string;
  outputDir?: string;
  baseFile?: string;
  targetFile?: string;
  baseUrl?: string;
  workflowId?: string;
  tokenEnv?: string;
  authorityMode?: 'TECHNICALLY_READ_ONLY' | 'CLIENT_ENFORCED_READ_ONLY' | 'UNKNOWN';
  connectionId?: string;
  observedArtifact?: string;
  manifestFile?: string;
  allowLoopbackHttp?: boolean;
  runtimeArtifact?: string;
}

export class CliCore {
  public static VERSION = '0.1.0-alpha.2';

  public static async execute(options: CliOptions): Promise<number> {
    try {
      if (['init', 'scan', 'validate', 'report'].includes(options.command)) {
        try {
          validateLocalProjectTarget(options.targetPath);
        } catch (error) {
          if (!(error instanceof ProjectAnalysisError)) throw error;
          console.error(`❌ ${error.message}`);
          if (error.code === 'REMOTE_TARGET_NOT_SUPPORTED') {
            console.error(`👉 tAIdyup will not clone or fetch remote code.`);
          } else if (error.code === 'TARGET_NOT_FOUND') {
            console.error(`👉 tAIdyup Alpha expects an existing local directory/workspace.`);
          } else if (error.code === 'TARGET_NOT_DIRECTORY') {
            console.error(`👉 tAIdyup Alpha expects a local directory/workspace, not a file.`);
          }
          return 2;
        }
      }

      switch (options.command) {
        case 'init':
          return await this.handleInit(options);
        case 'scan':
          return await this.handleScan(options);
        case 'validate':
          return await this.handleValidate(options);
        case 'report':
          return await this.handleReport(options);
        case 'diff':
          return await this.handleDiff(options);
        case 'connected-n8n':
          return await this.handleConnectedN8n(options);
        case 'runtime-import':
          return await this.handleRuntimeImport(options);
        case 'version':
          console.log(`taidyup v${this.VERSION}`);
          return 0;
        case 'help':
        default:
          this.printHelp();
          return 0;
      }
    } catch (err: any) {
      if (err instanceof RuntimeArtifactError) {
        console.error(`❌ Runtime artifact rejected [${err.code}]: ${err.message}`);
        return 2;
      }
      console.error(`💥 tAIdyup Internal Error: ${err?.message || err}`);
      return 3;
    }
  }

  private static async handleInit(options: CliOptions): Promise<number> {
    const targetDir = path.resolve(options.targetPath);
    console.log(`🚀 Initializing tAIdyup in \`${targetDir}\`...`);

    if (options.accept) {
      const draftPath = path.join(targetDir, 'taidyup.json.draft');
      const manifestPath = path.join(targetDir, 'taidyup.json');
      if (!fs.existsSync(draftPath)) {
        console.error('❌ No owner-reviewed declaration draft found. Run `taidyup init` and review it first.');
        return 2;
      }
      if (fs.existsSync(manifestPath)) {
        console.error(`❌ Refusing to overwrite existing declaration manifest at \`${manifestPath}\`.`);
        return 2;
      }

      let reviewDraft: any;
      try {
        reviewDraft = JSON.parse(fs.readFileSync(draftPath, 'utf-8'));
      } catch (error: any) {
        console.error(`❌ Invalid declaration draft JSON: ${error?.message || error}`);
        return 2;
      }

      const declarationManifest = {
        version: reviewDraft.version,
        project: reviewDraft.project,
        agents: reviewDraft.agents
      };
      const parsed = ManifestParser.parseManifest(declarationManifest, 'taidyup.json.draft');
      if (!parsed.isValid) {
        console.error('❌ No valid owner-reviewed declaration found. Candidate suggestions are observations, not declarations.');
        for (const error of parsed.errors) console.error(`   • ${error}`);
        return 2;
      }

      try {
        fs.writeFileSync(manifestPath, JSON.stringify(declarationManifest, null, 2), { encoding: 'utf-8', flag: 'wx' });
      } catch (error: any) {
        if (error?.code === 'EEXIST') {
          console.error(`❌ Refusing to overwrite existing declaration manifest at \`${manifestPath}\`.`);
          return 2;
        }
        throw error;
      }
      console.log(`✅ tAIdyup Declaration Manifest created at \`${manifestPath}\` (Status: DECLARED).`);
    } else {
      const scanRes = await ScannerCore.scanRepository(targetDir);
      const reviewDraft = {
        draftMetadata: {
          status: 'GENERATED_DRAFT',
          declarative: false,
          requiresOwnerReview: true,
          note: 'Candidate suggestions are scanner observations, not owner declarations.'
        },
        version: '1.0',
        project: path.basename(targetDir),
        agents: [],
        candidateSuggestions: scanRes.assets.map(asset => ({
          candidateId: asset.id,
          suggestedAssetType: asset.primaryAssetType,
          suggestedName: asset.name,
          technologySuggestions: {
            framework: asset.framework === 'NONE' ? null : { value: asset.framework, provenance: asset.frameworkEvidence || null },
            provider: asset.provider === 'UNKNOWN' ? null : { value: asset.provider, provenance: asset.providerEvidence || null },
            model: asset.model === 'UNKNOWN' ? null : { value: asset.model, provenance: asset.modelEvidence || null }
          },
          capabilitySuggestions: asset.capabilities.map(capability => ({
            declarationStatus: 'CANDIDATE_SUGGESTION',
            subject: capability.subject,
            action: capability.action,
            resource: capability.resource,
            constraint: capability.constraint,
            observationStatus: capability.status,
            evidenceStrength: capability.evidenceStrength,
            confidence: capability.confidence,
            provenance: capability.provenance
          })),
          scannerProvenance: asset.provenance,
          ownerInputRequired: true
        }))
      };
      const draftPath = path.join(targetDir, 'taidyup.json.draft');
      fs.writeFileSync(draftPath, JSON.stringify(reviewDraft, null, 2), 'utf-8');
      console.log(`📄 Draft manifest written to \`${draftPath}\`.`);
      console.log(`👉 Review candidateSuggestions, supply owner declarations explicitly, then create \`taidyup.json\`.`);
    }

    return 0;
  }

  private static async handleScan(options: CliOptions): Promise<number> {
    const targetDir = path.resolve(options.targetPath);
    console.log(`🔍 Running local tAIdyup AST scan on \`${targetDir}\`...`);

    const scanRes = await ScannerCore.scanRepository(targetDir);

    if (options.json) {
      const jsonStr = JSON.stringify(scanRes, null, 2);
      if (options.outputFile) {
        fs.writeFileSync(options.outputFile, jsonStr, 'utf-8');
        console.log(`📄 Scan JSON output written to \`${options.outputFile}\`.`);
      } else {
        console.log(jsonStr);
      }
      return 0;
    }

    console.log(`\n================================================================================`);
    console.log(`OBSERVED AI ESTATE (AST SCAN SUMMARY)`);
    console.log(`Scanned Path: ${scanRes.scannedPath}`);
    console.log(`Assets Discovered: ${scanRes.summary.totalAssets}`);
    console.log(`Agents Discovered: ${scanRes.summary.agentCount}`);
    console.log(`================================================================================\n`);

    for (const asset of scanRes.assets) {
      console.log(`• Asset: \`${asset.id}\` [${asset.primaryAssetType}] (${asset.framework || 'Custom'})`);
      for (const cap of asset.capabilities) {
        console.log(`  - Capability: \`${cap.action}\` on \`${cap.resource}\` (Strength: ${cap.evidenceStrength})`);
      }
    }
    console.log(``);
    return 0;
  }

  private static async handleValidate(options: CliOptions): Promise<number> {
    let analysis;
    try {
      analysis = await analyzeLocalProject(options.targetPath, { runtimeArtifactPath: options.runtimeArtifact });
    } catch (error) {
      if (!(error instanceof ProjectAnalysisError)) throw error;
      console.error(`❌ ${error.message}`);
      error.details.forEach(detail => console.error(`  - ${detail}`));
      if (error.code === 'MANIFEST_NOT_FOUND') console.error(`👉 Run \`taidyup init\` to generate a draft manifest.`);
      return 2;
    }
    const reconcileRes = analysis.reconciliation;

    console.log(`\n================================================================================`);
    console.log(`TAIDYUP VALIDATION REPORT`);
    console.log(`Project: ${analysis.project.name} | Timestamp: ${reconcileRes.timestamp}`);
    console.log(`================================================================================`);
    console.log(`• Total Claims:         ${reconcileRes.summary.totalClaims}`);
    console.log(`• Supported:            ${reconcileRes.summary.supportedCount} ✅`);
    console.log(`• Unverified:           ${reconcileRes.summary.unverifiedCount} ⚠️`);
    console.log(`• Conflicts:            ${reconcileRes.summary.conflictCount} 🚨`);
    console.log(`• Undeclared Authority: ${reconcileRes.summary.undeclaredCount} 🔍`);
    console.log(`• Unknowns:             ${reconcileRes.summary.unknownCount} ❓`);
    console.log(`• Critical Findings:    ${reconcileRes.summary.criticalFindingsCount} 💥`);
    console.log(`--------------------------------------------------------------------------------\n`);

    for (const claim of reconcileRes.reconciledClaims) {
      const tag = claim.status === 'SUPPORTED' ? '✅ SUPPORTED' :
                  claim.status === 'UNVERIFIED' ? '⚠️ UNVERIFIED' :
                  claim.status === 'CONFLICT' ? '🚨 CONFLICT' :
                  claim.status === 'UNDECLARED_OBSERVATION' ? '🔍 UNDECLARED' : '❓ UNKNOWN';
      console.log(`[${tag.padEnd(14)}] ${claim.subject} CAN ${claim.action || ''} ${claim.resource || ''}`);
    }

    if (reconcileRes.findings.length > 0) {
      console.log(`\n🚨 CRITICAL FINDINGS DETECTED:`);
      for (const f of reconcileRes.findings) {
        console.log(`  💥 [${f.severity}] ${f.title}: ${f.description} (${f.provenance.file})`);
      }
    }

    console.log(`\n================================================================================\n`);

    if (options.strict && (reconcileRes.summary.conflictCount > 0 || reconcileRes.summary.criticalFindingsCount > 0)) {
      console.error(`💥 STRICT MODE FAILED: Critical declaration conflicts or undeclared authority present.`);
      return 1;
    }

    return 0;
  }

  private static async handleReport(options: CliOptions): Promise<number> {
    const targetDir = validateLocalProjectTarget(options.targetPath);
    const outDir = options.outputDir ? path.resolve(options.outputDir) : targetDir;
    let analysis;
    try {
      analysis = await analyzeLocalProject(targetDir, { runtimeArtifactPath: options.runtimeArtifact });
    } catch (error) {
      if (!(error instanceof ProjectAnalysisError)) throw error;
      console.error(`❌ ${error.message}`);
      error.details.forEach(detail => console.error(`  - ${detail}`));
      return 2;
    }
    const state = analysis.reconciliation;

    const jsonPath = path.join(outDir, 'taidyup-report.json');
    const mdPath = path.join(outDir, 'TECHNICAL_PASSPORT.md');
    const sarifPath = path.join(outDir, 'taidyup.sarif');

    fs.writeFileSync(jsonPath, JSON.stringify(state, null, 2), 'utf-8');

    const markdownReport = ReportGenerator.generateMarkdownReport(analysis.project.name, state);
    fs.writeFileSync(mdPath, markdownReport, 'utf-8');

    const sarifData = SarifExporter.exportToSarif(analysis.project.name, state);
    fs.writeFileSync(sarifPath, JSON.stringify(sarifData, null, 2), 'utf-8');

    console.log(`📄 Technical Validation Report generated:`);
    console.log(`   - JSON Report:        ${jsonPath}`);
    console.log(`   - Technical Passport: ${mdPath}`);
    console.log(`   - SARIF Report:       ${sarifPath}`);

    return 0;
  }

  private static async handleDiff(options: CliOptions): Promise<number> {
    if (!options.baseFile || !options.targetFile) {
      console.error(`❌ Usage: taidyup diff <baseReportJson> <targetReportJson>`);
      return 2;
    }

    const baseState = JSON.parse(fs.readFileSync(path.resolve(options.baseFile), 'utf-8'));
    const targetState = JSON.parse(fs.readFileSync(path.resolve(options.targetFile), 'utf-8'));

    const diffRes = DiffEngine.computeDiff(baseState, targetState);
    console.log(diffRes.summaryText);

    return 0;
  }

  private static async handleConnectedN8n(options: CliOptions): Promise<number> {
    if (!options.baseUrl || !options.workflowId) {
      console.error('❌ Usage: taidyup connected-n8n --base-url <url> --workflow <id> [--token-env N8N_API_KEY]');
      return 2;
    }
    const tokenEnv = options.tokenEnv || 'N8N_API_KEY';
    const token = process.env[tokenEnv];
    if (!token) { console.error(`❌ Required token environment variable ${tokenEnv} is not set.`); return 2; }
    const authorityMode = options.authorityMode || 'UNKNOWN';
    if (!['TECHNICALLY_READ_ONLY', 'CLIENT_ENFORCED_READ_ONLY', 'UNKNOWN'].includes(authorityMode)) {
      console.error('❌ Invalid authority mode.'); return 2;
    }
    const endpoint = new URL(options.baseUrl);
    const disclosedAuthority = authorityMode === 'CLIENT_ENFORCED_READ_ONLY' ? authorityMode : 'UNKNOWN';
    console.log(`🌐 CONNECTED opt-in: provider=n8n host=${endpoint.origin} requests=workflow:list,workflow:read methods=GET authorityMode=${disclosedAuthority} declaredAuthorityMode=${authorityMode} execution=false`);
    let declaredClaims: any[] = []; let declarationEvidence: any[] = [];
    if (options.manifestFile) {
      const parsed = ManifestParser.parseManifest(JSON.parse(fs.readFileSync(path.resolve(options.manifestFile), 'utf8')), options.manifestFile);
      if (!parsed.isValid) { console.error(`❌ Invalid owner-reviewed manifest: ${parsed.errors.join('; ')}`); return 2; }
      declaredClaims = parsed.claims; declarationEvidence = parsed.evidences;
    }
    const result = await analyzeConnectedN8nWorkflow({
      config: { provider: 'n8n', baseUrl: options.baseUrl, token, connectionId: options.connectionId || endpoint.host, authorityMode, allowLoopbackHttp: options.allowLoopbackHttp },
      workflowId: options.workflowId, observedArtifactPath: options.observedArtifact ? path.resolve(options.observedArtifact) : undefined,
      declaredClaims, declarationEvidence
    });
    const output = { disclosure: result.disclosure, snapshot: result.snapshot, diagnostics: result.diagnostics, absenceCount: result.absenceEvidences.length, reconciliation: result.reconciliation };
    console.log(JSON.stringify(output, null, 2));
    return 0;
  }

  private static async handleRuntimeImport(options: CliOptions): Promise<number> {
    if (!options.runtimeArtifact) {
      console.error('❌ Usage: taidyup runtime-import <artifact.jsonl> [targetDir]');
      return 2;
    }
    const analysis = await analyzeLocalProject(options.targetPath, { runtimeArtifactPath: options.runtimeArtifact });
    console.log(JSON.stringify({
      disclosure: {
        mode: 'EXPLICIT_LOCAL_RUNTIME_IMPORT', network: false, monitoring: false,
        completeness: 'PARTIAL_OBSERVATION', authorizationEstablished: false
      },
      runtime: analysis.runtime,
      reconciliation: analysis.reconciliation
    }, null, 2));
    return 0;
  }

  private static printHelp(): void {
    console.log(`
tAIdyup CLI v${this.VERSION}
Evidence-Backed Technical Governance for AI Builders

USAGE:
  npx taidyup <command> [targetDir] [options]

COMMANDS:
  init      [targetDir]        Inspect project and generate draft taidyup.json
  scan      [targetDir]        Run local AST code scan of AI assets and tools
  validate  [targetDir]        Reconcile taidyup.json against local code scan
  report    [targetDir]        Export JSON report, TECHNICAL_PASSPORT.md & taidyup.sarif
  diff      <base> <target>    Compute semantic authority diff between two reports
  connected-n8n                Explicitly inspect current n8n workflow configuration
  runtime-import <jsonl> [dir] Explicitly import a sanitized local runtime artifact

OPTIONS:
  --accept, -y                 Validate and accept owner-reviewed agents[] from the existing draft
  --strict                     Fail validate with exit code 1 if critical findings exist
  --json                       Output raw JSON for scan
  --output, -o <file>          Save scan output to file
  --output-dir <dir>           Directory to save generated report artifacts
  --base-url <url>             Explicit n8n instance URL (CONNECTED only)
  --workflow <id>              Exact n8n workflow ID (CONNECTED only)
  --token-env <name>           Environment variable containing API key (default N8N_API_KEY)
  --authority-mode <mode>      TECHNICALLY_READ_ONLY, CLIENT_ENFORCED_READ_ONLY, or UNKNOWN
  --connection-id <id>         Local identity for the configured connection
  --observed-artifact <file>   Explicit local artifact to compare with current configuration
  --manifest <file>            Owner-reviewed declaration manifest for reconciliation
  --allow-loopback-http        Permit explicit HTTP only on loopback for disposable/local n8n
  --runtime-artifact <file>    Explicit sanitized JSONL runtime evidence for validate/report
  --version, -v                Print CLI version
  --help, -h                   Print help menu
`);
  }
}
