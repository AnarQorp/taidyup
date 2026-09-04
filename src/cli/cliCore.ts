import fs from 'fs';
import path from 'path';
import { ScannerCore } from '../scanner/scannerCore.js';
import { ReportGenerator } from '../trust-kernel/reportGenerator.js';
import { SarifExporter } from './sarifExporter.js';
import { DiffEngine } from './diffEngine.js';
import {
  analyzeLocalProject,
  ProjectAnalysisError,
  validateLocalProjectTarget
} from '../application/analyzeLocalProject.js';

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
}

export class CliCore {
  public static VERSION = '0.1.0-alpha.1';

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
        case 'version':
          console.log(`taidyup v${this.VERSION}`);
          return 0;
        case 'help':
        default:
          this.printHelp();
          return 0;
      }
    } catch (err: any) {
      console.error(`💥 tAIdyup Internal Error: ${err?.message || err}`);
      return 3;
    }
  }

  private static async handleInit(options: CliOptions): Promise<number> {
    const targetDir = path.resolve(options.targetPath);
    console.log(`🚀 Initializing tAIdyup in \`${targetDir}\`...`);

    const scanRes = await ScannerCore.scanRepository(targetDir);

    const proposedAgents = scanRes.assets.map(asset => ({
      id: asset.id,
      name: asset.name,
      purpose: `Candidate asset detected as ${asset.primaryAssetType} using ${asset.framework || 'unknown framework'}`,
      owner: { name: 'Developer Name', email: 'dev@company.com' },
      provider: asset.provider,
      framework: asset.framework,
      capabilities: asset.capabilities.map(c => ({
        action: c.action,
        resource: c.resource
      }))
    }));

    const draftManifest = {
      version: '1.0',
      project: path.basename(targetDir),
      agents: proposedAgents.length > 0 ? proposedAgents : [{
        id: 'main-agent',
        name: 'Main AI Agent',
        purpose: 'Primary application AI agent',
        owner: { name: 'Developer', email: 'dev@company.com' },
        capabilities: [{ action: 'READ', resource: 'database:main' }]
      }]
    };

    const draftHeader = `# ==========================================================================\n` +
                        `# TAIDYUP DECLARATION MANIFEST (GENERATED DRAFT)\n` +
                        `# Status: GENERATED_DRAFT (Requires explicit developer review)\n` +
                        `# Note: Inferred observations below are candidate suggestions, NOT declared.\n` +
                        `# ==========================================================================\n\n`;

    const draftContent = draftHeader + JSON.stringify(draftManifest, null, 2);

    if (options.accept) {
      const manifestPath = path.join(targetDir, 'taidyup.json');
      fs.writeFileSync(manifestPath, JSON.stringify(draftManifest, null, 2), 'utf-8');
      console.log(`✅ tAIdyup Declaration Manifest created at \`${manifestPath}\` (Status: DECLARED).`);
    } else {
      const draftPath = path.join(targetDir, 'taidyup.json.draft');
      fs.writeFileSync(draftPath, draftContent, 'utf-8');
      console.log(`📄 Draft manifest written to \`${draftPath}\`.`);
      console.log(`👉 Review and confirm the manifest, then move to \`taidyup.json\` (or re-run with \`--accept\`).`);
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
      analysis = await analyzeLocalProject(options.targetPath);
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
      analysis = await analyzeLocalProject(targetDir);
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

OPTIONS:
  --accept, -y                 Accept draft manifest during init (GENERATED_DRAFT -> DECLARED)
  --strict                     Fail validate with exit code 1 if critical findings exist
  --json                       Output raw JSON for scan
  --output, -o <file>          Save scan output to file
  --output-dir <dir>           Directory to save generated report artifacts
  --version, -v                Print CLI version
  --help, -h                   Print help menu
`);
  }
}
