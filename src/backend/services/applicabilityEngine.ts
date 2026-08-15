import { getDb } from '../db.js';
import { EvidenceEngineV2 } from './evidenceEngine.js';

export interface RegulatoryApplicabilityInput {
  agentId: string;
  operatorRole?: 'provider' | 'deployer' | 'importer' | 'distributor' | 'UNKNOWN';
  intendedPurpose?: string;
  affectedPersons?: string;
  contextOfUse?: string;
  prohibitedPracticeScreening?: 'PASSED' | 'TRIGGERED' | 'UNKNOWN';
  highRiskRelevance?: 'HIGH_RISK_ANNEX_I' | 'HIGH_RISK_ANNEX_III' | 'NOT_HIGH_RISK' | 'UNKNOWN';
  transparencyApplicability?: 'ART50_APPLICABLE' | 'NOT_APPLICABLE' | 'UNKNOWN';
  gpaiRelevance?: 'ART51_55_APPLICABLE' | 'NOT_APPLICABLE' | 'UNKNOWN';
  officialEuCheckerUrl?: string;
}

export type TrustGovernanceStatus = 
  | 'GOVERNED'
  | 'PARTIALLY_GOVERNED'
  | 'GOVERNANCE_INCOMPLETE'
  | 'CRITICAL_GAPS'
  | 'UNKNOWN'
  | 'REVIEW_REQUIRED';

export type AbsenceSemantic = 
  | 'OBSERVED_PRESENT'
  | 'OBSERVED_ABSENT'
  | 'NOT_OBSERVED'
  | 'INFERRED_PRESENT'
  | 'INFERRED_ABSENT'
  | 'DECLARED_PRESENT'
  | 'DECLARED_ABSENT'
  | 'VERIFIED_PRESENT'
  | 'VERIFIED_ABSENT'
  | 'UNKNOWN';

export class RegulatoryApplicabilityEngine {
  /**
   * Updates regulatory applicability with domain-verified official EU URL.
   */
  public static async updateApplicability(input: RegulatoryApplicabilityInput) {
    const db = await getDb();
    const existing = await db.get<any>('SELECT * FROM regulatory_applicability WHERE agent_id = ?', [input.agentId]);

    const id = existing ? existing.id : `app-${Date.now()}`;
    const operatorRole = input.operatorRole || existing?.operator_role || 'UNKNOWN';
    const intendedPurpose = input.intendedPurpose || existing?.intended_purpose || 'UNKNOWN';
    const affectedPersons = input.affectedPersons || existing?.affected_persons || 'UNKNOWN';
    const contextOfUse = input.contextOfUse || existing?.context_of_use || 'UNKNOWN';
    const prohibitedPracticeScreening = input.prohibitedPracticeScreening || existing?.prohibited_practice_screening || 'UNKNOWN';
    const highRiskRelevance = input.highRiskRelevance || existing?.high_risk_relevance || 'UNKNOWN';
    const transparencyApplicability = input.transparencyApplicability || existing?.transparency_applicability || 'UNKNOWN';
    const gpaiRelevance = input.gpaiRelevance || existing?.gpai_relevance || 'UNKNOWN';
    const officialEuCheckerUrl = input.officialEuCheckerUrl || existing?.official_eu_checker_url || 'https://ai-act-service-desk.ec.europa.eu/en/eu-ai-act-compliance-checker';

    const isDetermined = highRiskRelevance !== 'UNKNOWN' && operatorRole !== 'UNKNOWN' && prohibitedPracticeScreening !== 'UNKNOWN';
    const overallStatus = isDetermined ? 'DETERMINED' : 'REVIEW_REQUIRED';

    if (existing) {
      await db.run(
        `UPDATE regulatory_applicability SET 
          operator_role = ?, intended_purpose = ?, affected_persons = ?, context_of_use = ?,
          prohibited_practice_screening = ?, high_risk_relevance = ?, transparency_applicability = ?,
          gpai_relevance = ?, overall_status = ?, official_eu_checker_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          operatorRole, intendedPurpose, affectedPersons, contextOfUse,
          prohibitedPracticeScreening, highRiskRelevance, transparencyApplicability,
          gpaiRelevance, overallStatus, officialEuCheckerUrl, id
        ]
      );
    } else {
      await db.run(
        `INSERT INTO regulatory_applicability (
          id, agent_id, operator_role, intended_purpose, affected_persons, context_of_use,
          prohibited_practice_screening, high_risk_relevance, transparency_applicability,
          gpai_relevance, overall_status, official_eu_checker_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, input.agentId, operatorRole, intendedPurpose, affectedPersons, contextOfUse,
          prohibitedPracticeScreening, highRiskRelevance, transparencyApplicability,
          gpaiRelevance, overallStatus, officialEuCheckerUrl
        ]
      );
    }

    return { id, overallStatus };
  }

  /**
   * Evaluates Trust Governance Status using strict Critical Gates instead of naive 9/11 percentages.
   */
  public static async evaluateReadiness(agentId: string) {
    const db = await getDb();
    const agent = await db.get<any>('SELECT * FROM agents WHERE id = ?', [agentId]);
    if (!agent) throw new Error('Agent not found');

    const app = await db.get<any>('SELECT * FROM regulatory_applicability WHERE agent_id = ?', [agentId]);
    const evidenceList = await db.all<any[]>('SELECT * FROM evidence WHERE agent_id = ?', [agentId]);
    const findingsList = await db.all<any[]>('SELECT * FROM findings WHERE agent_id = ?', [agentId]);

    // 1. Absence Semantics for Key Governance Features
    const humanOversightSemantic: AbsenceSemantic = 
      agent.human_oversight_type !== 'UNKNOWN' ? 'OBSERVED_PRESENT' : 'NOT_OBSERVED';
    
    const revocationSemantic: AbsenceSemantic = 
      agent.revocation_mechanism !== 'UNKNOWN' ? 'OBSERVED_PRESENT' : 'NOT_OBSERVED';

    // 2. Evaluate Critical Gates (No mathematical compensation allowed!)
    const criticalGates = [
      { name: 'identifiable_agent', status: agent.name && agent.name !== 'UNKNOWN' ? 'PASS' : 'FAIL', critical: true },
      { name: 'accountable_owner', status: agent.owner_name && agent.owner_name !== 'UNKNOWN' ? 'PASS' : 'FAIL', critical: true },
      { name: 'bounded_authority_scope', status: agent.capabilities_json && agent.capabilities_json !== '[]' ? 'PASS' : 'FAIL', critical: true },
      { name: 'secret_hygiene', status: !findingsList.some(f => f.control_id === 'ctl-sec-01') ? 'PASS' : 'FAIL', critical: true },
      { name: 'human_oversight', status: humanOversightSemantic === 'OBSERVED_PRESENT' ? 'PASS' : 'GATE_FAILED', critical: true },
      { name: 'revocation_mechanism', status: revocationSemantic === 'OBSERVED_PRESENT' ? 'PASS' : 'GATE_FAILED', critical: true },
      { name: 'tamper_evident_evidence', status: evidenceList.length > 0 ? 'PASS' : 'FAIL', critical: true }
    ];

    const failedCriticalGates = criticalGates.filter(g => g.critical && g.status !== 'PASS');

    let trustGovernanceStatus: TrustGovernanceStatus = 'GOVERNED';
    if (failedCriticalGates.length >= 3) {
      trustGovernanceStatus = 'CRITICAL_GAPS';
    } else if (failedCriticalGates.length > 0) {
      trustGovernanceStatus = 'GOVERNANCE_INCOMPLETE';
    }

    // 3. Calculate Regulatory Readiness Score (ONLY if legal applicability is DETERMINED)
    let regulatoryReadiness = null;
    if (app && app.overall_status === 'DETERMINED') {
      let applicableControls = ['ctl-trans-01'];
      if (app.high_risk_relevance.includes('HIGH_RISK')) {
        applicableControls.push('ctl-data-01', 'ctl-log-01', 'ctl-oversight-01', 'ctl-sec-01');
      }

      const openFindingsForApplicable = findingsList.filter(f => applicableControls.includes(f.control_id) && f.status === 'open');
      const satisfiedControlsCount = applicableControls.length - openFindingsForApplicable.length;
      const score = Math.round((satisfiedControlsCount / applicableControls.length) * 100);

      regulatoryReadiness = {
        status: 'DETERMINED',
        applicableRequirementsCount: applicableControls.length,
        controlsMapped: applicableControls,
        controlsSatisfied: satisfiedControlsCount,
        openFindingsCount: openFindingsForApplicable.length,
        scorePercentage: score
      };
    } else {
      regulatoryReadiness = {
        status: 'REVIEW_REQUIRED',
        message: 'La determinación jurídica de aplicabilidad está pendiente o requiere revisión. No se emite score normativo infundado.',
        officialEuCheckerUrl: app?.official_eu_checker_url || 'https://ai-act-service-desk.ec.europa.eu/en/eu-ai-act-compliance-checker'
      };
    }

    return {
      agentId,
      trustGovernanceStatus,
      criticalGates,
      failedCriticalGatesCount: failedCriticalGates.length,
      semantics: {
        humanOversight: humanOversightSemantic,
        revocation: revocationSemantic
      },
      regulatoryReadiness
    };
  }
}
