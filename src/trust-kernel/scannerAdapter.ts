import crypto from 'crypto';
import { AIEstateScanResult, DiscoveredAssetSignal } from '../scanner/types.js';
import { Claim, Evidence, EvidenceStrength } from './types.js';

export interface ScannerAdapterOutput {
  claims: Claim[];
  evidences: Evidence[];
}

export class ScannerAdapter {
  /**
   * Adapts pure ScannerCore scan output into Trust Kernel Evidence and Claims.
   */
  public static adaptScanResult(scanRes: AIEstateScanResult): ScannerAdapterOutput {
    const claims: Claim[] = [];
    const evidences: Evidence[] = [];

    for (const asset of scanRes.assets) {
      const subjectId = `agent:${asset.id}`;

      // Create Asset Discovery Evidence
      const sanitizedData = {
        primaryAssetType: asset.primaryAssetType,
        framework: asset.framework,
        provider: asset.provider,
        toolsCount: asset.tools.length,
        capabilitiesCount: asset.capabilities.length
      };
      const sha256 = crypto.createHash('sha256').update(JSON.stringify(sanitizedData)).digest('hex');

      const assetEv: Evidence = {
        id: `ev-stat-asset-${asset.id}`,
        type: 'STATIC_AST_SCAN',
        sourceType: 'STATIC',
        subject: subjectId,
        observedAt: scanRes.timestamp,
        collectorId: 'taidyup-scanner-core',
        collectorVersion: scanRes.scannerVersion,
        artifact: scanRes.scannedPath,
        data: sanitizedData,
        strength: asset.primaryAssetType === 'AGENT' ? 'AGENT_BOUND' : 'DEPENDENCY_ONLY',
        sha256,
        provenance: { file: asset.provenance.sources[0] || 'repository' }
      };
      evidences.push(assetEv);

      // Convert Capabilities into Observed Evidence & Claims
      for (const capClaim of asset.capabilities) {
        const capEvId = `ev-stat-cap-${asset.id}-${capClaim.action}`;
        const capData = {
          capability: capClaim.action,
          resource: capClaim.resource,
          constraint: capClaim.constraint,
          evidenceStrength: capClaim.evidenceStrength
        };
        const capSha256 = crypto.createHash('sha256').update(JSON.stringify(capData)).digest('hex');

        const capEv: Evidence = {
          id: capEvId,
          type: 'STATIC_CAPABILITY_OBSERVATION',
          sourceType: 'STATIC',
          subject: subjectId,
          observedAt: scanRes.timestamp,
          collectorId: 'taidyup-scanner-core',
          collectorVersion: scanRes.scannerVersion,
          artifact: capClaim.provenance.file,
          location: capClaim.provenance.lineRange,
          data: capData,
          strength: capClaim.evidenceStrength,
          sha256: capSha256,
          provenance: { file: capClaim.provenance.file }
        };
        evidences.push(capEv);

        claims.push({
          id: `claim-stat-${asset.id}-${capClaim.action}`,
          subject: subjectId,
          predicate: 'CAN',
          action: capClaim.action,
          resource: capClaim.resource,
          source: 'STATIC',
          status: capClaim.evidenceStrength === 'AGENT_BOUND' ? 'INFERRED' : 'OBSERVED',
          confidence: capClaim.confidence,
          provenance: [{
            sourceType: 'STATIC',
            artifact: scanRes.scannedPath,
            location: capClaim.provenance.file,
            snippet: capClaim.provenance.snippet,
            collectorId: 'taidyup-scanner-core',
            evidenceId: capEvId
          }]
        });
      }
    }

    return { claims, evidences };
  }
}
