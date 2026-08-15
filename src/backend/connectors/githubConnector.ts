import crypto from 'crypto';
import { getDb } from '../db.js';
import { EvidenceEngineV2 } from '../services/evidenceEngine.js';
import { RegulatoryApplicabilityEngine } from '../services/applicabilityEngine.js';
import { ScannerCore } from '../../scanner/scannerCore.js';

export interface DiscoveredAgentSignal {
  id: string;
  name: string;
  ownerName: string;
  ownerRole: string;
  purpose: string;
  provider: string;
  model: string;
  framework: string;
  protocols: string[];
  tools: Array<{ id: string; name: string; category: string; evidenceRef?: string }>;
  resources: string[];
  credentialsReferenced: string[];
  capabilities: Array<{ capability: string; target: string; constraint: string }>;
  humanOversightType: 'human-in-the-loop' | 'kill-switch' | 'UNKNOWN';
  revocationMechanism: string;
  autonomyLevel: 'LOW_AUTONOMY' | 'MEDIUM_AUTONOMY' | 'HIGH_AUTONOMY' | 'UNKNOWN';
  technicalExposure: 'LOW_TECHNICAL_EXPOSURE' | 'MEDIUM_TECHNICAL_EXPOSURE' | 'HIGH_TECHNICAL_EXPOSURE' | 'REVIEW_REQUIRED';
  provenance: {
    signal: string;
    sources: string[];
    confidence: number;
  };
}

export class GitHubConnectorV2 {
  /**
   * SaaS Wrapper around ScannerCore.scanRepository.
   */
  public static async runDiscovery(orgId: string, connectorId: string, repoPath: string) {
    const db = await getDb();
    const startTime = new Date();

    const runId = `run-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    await db.run(
      `INSERT INTO connector_runs (id, connector_id, target_resource, status, started_at)
       VALUES (?, ?, ?, 'running', ?)`,
      [runId, connectorId, repoPath, startTime.toISOString()]
    );

    // Call pure ScannerCore
    const scanRes = await ScannerCore.scanRepository(repoPath);
    const primaryAsset = scanRes.assets[0];

    const discoveredAgents: DiscoveredAgentSignal[] = [];
    const evidenceIdsRecorded: string[] = [];

    // ONLY create agent signal if primaryAssetType === 'AGENT'
    if (primaryAsset && primaryAsset.primaryAssetType === 'AGENT') {
      const agentSignal: DiscoveredAgentSignal = {
        id: primaryAsset.id,
        name: primaryAsset.name,
        ownerName: 'Tech Lead / DevOps Team',
        ownerRole: 'Software Engineer',
        purpose: primaryAsset.purpose,
        provider: primaryAsset.provider,
        model: primaryAsset.model,
        framework: primaryAsset.framework,
        protocols: primaryAsset.protocols,
        tools: primaryAsset.tools.map(t => ({ id: t.id, name: t.name, category: t.category })),
        resources: primaryAsset.resources,
        credentialsReferenced: primaryAsset.credentialDependencies.map(c => c.name),
        capabilities: primaryAsset.capabilities.map(c => ({ capability: c.action, target: c.resource, constraint: c.constraint })),
        humanOversightType: 'UNKNOWN',
        revocationMechanism: 'UNKNOWN',
        autonomyLevel: primaryAsset.tools.some(t => t.category === 'shell') ? 'HIGH_AUTONOMY' : 'LOW_AUTONOMY',
        technicalExposure: primaryAsset.tools.some(t => t.category === 'shell') ? 'HIGH_TECHNICAL_EXPOSURE' : 'LOW_TECHNICAL_EXPOSURE',
        provenance: {
          signal: primaryAsset.provenance.signal,
          sources: primaryAsset.provenance.sources,
          confidence: primaryAsset.provenance.confidence
        }
      };

      discoveredAgents.push(agentSignal);

      // Upsert Agent in DB
      await db.run(
        `INSERT INTO agents (
          id, org_id, name, owner_name, owner_role, purpose, provider, model, framework,
          protocols_json, tools_json, resources_json, credentials_referenced_json,
          capabilities_json, human_oversight_type, revocation_mechanism, autonomy_level,
          technical_exposure, provenance_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          org_id = excluded.org_id,
          provider = excluded.provider,
          model = excluded.model,
          framework = excluded.framework,
          tools_json = excluded.tools_json,
          credentials_referenced_json = excluded.credentials_referenced_json,
          capabilities_json = excluded.capabilities_json,
          technical_exposure = excluded.technical_exposure,
          provenance_json = excluded.provenance_json,
          updated_at = CURRENT_TIMESTAMP`,
        [
          primaryAsset.id,
          orgId,
          agentSignal.name,
          agentSignal.ownerName,
          agentSignal.ownerRole,
          agentSignal.purpose,
          agentSignal.provider,
          agentSignal.model,
          agentSignal.framework,
          JSON.stringify(agentSignal.protocols),
          JSON.stringify(agentSignal.tools),
          JSON.stringify(agentSignal.resources),
          JSON.stringify(agentSignal.credentialsReferenced),
          JSON.stringify(agentSignal.capabilities),
          agentSignal.humanOversightType,
          agentSignal.revocationMechanism,
          agentSignal.autonomyLevel,
          agentSignal.technicalExposure,
          JSON.stringify(agentSignal.provenance)
        ]
      );

      // Initialize Legal Applicability
      await RegulatoryApplicabilityEngine.updateApplicability({
        agentId: primaryAsset.id,
        operatorRole: 'deployer',
        intendedPurpose: agentSignal.purpose
      });

      // Record Evidence
      const ev1 = await EvidenceEngineV2.recordEvidence({
        orgId,
        agentId: primaryAsset.id,
        controlId: 'ctl-sec-01',
        sourceConnector: 'github',
        method: 'scanner-core-estate-audit',
        observedResource: repoPath,
        rawData: {
          assetType: primaryAsset.primaryAssetType,
          detectedFramework: primaryAsset.framework,
          detectedProvider: primaryAsset.provider,
          credentialsReferenced: agentSignal.credentialsReferenced
        },
        epistemologicalState: 'OBSERVED',
        subjectType: 'AGENT',
        subjectId: primaryAsset.id,
        scope: 'AGENT_AUTHORITY',
        evidenceStrength: 'AGENT_BOUND',
        collectorName: 'tAIdyup Scanner Core',
        collectorVersion: ScannerCore.SCANNER_VERSION
      });
      evidenceIdsRecorded.push(ev1);
    }

    const endTime = new Date();
    await db.run(
      `UPDATE connector_runs SET status = 'completed', items_scanned = 1, evidence_collected = ?, completed_at = ? WHERE id = ?`,
      [evidenceIdsRecorded.length, endTime.toISOString(), runId]
    );

    return {
      runId,
      repoPathOrUrl: repoPath,
      agentsDiscovered: discoveredAgents.length,
      evidencesRecorded: evidenceIdsRecorded.length,
      agents: discoveredAgents,
      scanResult: scanRes
    };
  }
}
