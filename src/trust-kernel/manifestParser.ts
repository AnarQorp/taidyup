import crypto from 'crypto';
import { CapabilityAction, Claim, Evidence, EvidenceStrength, SourceType } from './types.js';

export interface ParsedManifestResult {
  isValid: boolean;
  errors: string[];
  claims: Claim[];
  evidences: Evidence[];
}

export class ManifestParser {
  /**
   * Parses and validates a tAIdyup Declaration Manifest V0 (JSON or YAML object).
   */
  public static parseManifest(manifestData: any, artifactPath = 'taidyup.yaml'): ParsedManifestResult {
    const errors: string[] = [];
    const claims: Claim[] = [];
    const evidences: Evidence[] = [];

    if (!manifestData || typeof manifestData !== 'object') {
      return { isValid: false, errors: ['Manifest data must be a non-null object'], claims: [], evidences: [] };
    }

    if (!manifestData.version) errors.push('Missing required property "version"');
    if (!manifestData.project) errors.push('Missing required property "project"');
    if (!Array.isArray(manifestData.agents) || manifestData.agents.length === 0) {
      errors.push('Manifest must contain a non-empty "agents" array');
      return { isValid: false, errors, claims: [], evidences: [] };
    }

    const agentIds = new Set<string>();

    for (let index = 0; index < manifestData.agents.length; index++) {
      const agent = manifestData.agents[index];
      if (!agent.id) {
        errors.push(`Agent at index ${index} is missing "id"`);
        continue;
      }
      if (agentIds.has(agent.id)) {
        errors.push(`Duplicate agent ID "${agent.id}" detected`);
      }
      agentIds.add(agent.id);

      if (!agent.name) errors.push(`Agent "${agent.id}" missing "name"`);
      if (!agent.purpose) errors.push(`Agent "${agent.id}" missing "purpose"`);
      if (!agent.owner || !agent.owner.name || !agent.owner.email) {
        errors.push(`Agent "${agent.id}" missing complete "owner" (name, email required)`);
      }

      const subjectId = `agent:${agent.id}`;

      // Create Declaration Evidence
      const sanitizedPayload = JSON.stringify(agent);
      const sha256Hash = crypto.createHash('sha256').update(sanitizedPayload).digest('hex');

      const manifestEv: Evidence = {
        id: `ev-decl-${agent.id}`,
        type: 'DECLARATION_MANIFEST',
        sourceType: 'DECLARATION',
        subject: subjectId,
        observedAt: new Date().toISOString(),
        collectorId: 'taidyup-manifest-parser',
        collectorVersion: '1.0.0',
        artifact: artifactPath,
        data: agent,
        strength: 'DEPENDENCY_ONLY',
        sha256: sha256Hash,
        provenance: { file: artifactPath }
      };
      evidences.push(manifestEv);

      // Identity Claims
      claims.push({
        id: `claim-id-${agent.id}`,
        subject: subjectId,
        predicate: 'MUST',
        source: 'DECLARATION',
        status: 'DECLARED',
        confidence: 0.5,
        provenance: [{ sourceType: 'DECLARATION', artifact: artifactPath, location: `agents[${index}].id`, evidenceId: manifestEv.id }]
      });

      if (agent.owner) {
        claims.push({
          id: `claim-owner-${agent.id}`,
          subject: subjectId,
          predicate: 'CAN',
          resource: `owner:${agent.owner.email}`,
          source: 'DECLARATION',
          status: 'DECLARED',
          confidence: 0.5,
          provenance: [{ sourceType: 'DECLARATION', artifact: artifactPath, location: `agents[${index}].owner`, evidenceId: manifestEv.id }]
        });
      }

      // Capability Claims
      if (Array.isArray(agent.capabilities)) {
        for (let capIdx = 0; capIdx < agent.capabilities.length; capIdx++) {
          const cap = agent.capabilities[capIdx];
          const validActions: CapabilityAction[] = ['READ', 'WRITE', 'CREATE', 'UPDATE', 'DELETE', 'EXECUTE', 'SEND', 'PUBLISH', 'APPROVE', 'PURCHASE', 'TRANSFER', 'ADMIN'];
          if (!validActions.includes(cap.action)) {
            errors.push(`Agent "${agent.id}" capability index ${capIdx} has invalid action "${cap.action}"`);
            continue;
          }

          claims.push({
            id: `claim-cap-${agent.id}-${cap.action}-${capIdx}`,
            subject: subjectId,
            predicate: cap.predicate || 'CAN',
            action: cap.action as CapabilityAction,
            resource: cap.resource,
            constraints: cap.constraints || {},
            source: 'DECLARATION',
            status: 'DECLARED',
            confidence: 0.5,
            provenance: [{ sourceType: 'DECLARATION', artifact: artifactPath, location: `agents[${index}].capabilities[${capIdx}]`, evidenceId: manifestEv.id }]
          });
        }
      }

      // Oversight Claims
      if (agent.oversight) {
        claims.push({
          id: `claim-oversight-${agent.id}`,
          subject: subjectId,
          predicate: agent.oversight.human_in_the_loop ? 'MUST' : 'CANNOT',
          resource: 'human_oversight',
          constraints: { approval_required: agent.oversight.approval_required },
          source: 'DECLARATION',
          status: 'DECLARED',
          confidence: 0.5,
          provenance: [{ sourceType: 'DECLARATION', artifact: artifactPath, location: `agents[${index}].oversight`, evidenceId: manifestEv.id }]
        });
      }

      // Revocation Claims
      if (agent.revocation || agent.oversight?.revocation_mechanism) {
        const mech = agent.revocation?.mechanism || agent.oversight?.revocation_mechanism;
        claims.push({
          id: `claim-revocation-${agent.id}`,
          subject: subjectId,
          predicate: 'MUST',
          resource: 'revocation_mechanism',
          constraints: { mechanism: mech },
          source: 'DECLARATION',
          status: 'DECLARED',
          confidence: 0.5,
          provenance: [{ sourceType: 'DECLARATION', artifact: artifactPath, location: `agents[${index}].revocation`, evidenceId: manifestEv.id }]
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      claims,
      evidences
    };
  }
}
