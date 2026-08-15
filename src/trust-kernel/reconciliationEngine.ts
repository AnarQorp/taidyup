import {
  CapabilityAction,
  Claim,
  EpistemicState,
  Evidence,
  EvidenceStrength,
  ReconciledTrustState,
  TechnicalFinding
} from './types.js';

export class ReconciliationEngine {
  public static ENGINE_VERSION = '1.0.0';

  private static CRITICAL_ACTIONS: CapabilityAction[] = [
    'DELETE', 'EXECUTE', 'SEND', 'PUBLISH', 'APPROVE', 'PURCHASE', 'TRANSFER', 'ADMIN'
  ];

  /**
   * Pure, deterministic reconciliation engine.
   * Input: Manifest Claims, Scanner Evidence, and optional relationship edges.
   * Output: ReconciledTrustState (Reconciled Claims, Epistemic States, Findings, Summary).
   */
  public static reconcile(inputClaims: Claim[], inputEvidences: Evidence[]): ReconciledTrustState {
    const timestamp = new Date().toISOString();
    const reconciledClaims: Claim[] = [];
    const findings: TechnicalFinding[] = [];

    // Separate declared vs observed claims
    const declaredClaims = inputClaims.filter(c => c.source === 'DECLARATION');
    const staticEvidences = inputEvidences.filter(e => e.sourceType === 'STATIC');

    // Track reconciled actions per agent subject
    const processedKeys = new Set<string>();

    for (const dClaim of declaredClaims) {
      const key = `${dClaim.subject}:${dClaim.action || 'ALL'}:${dClaim.resource || 'ALL'}`;
      processedKeys.add(key);

      // Subject Isolation Guard: Ensure evidence subject matches claim subject
      const matchingEvidences = staticEvidences.filter(e => e.subject === dClaim.subject);

      // Find matching capability evidence
      const capEvidence = matchingEvidences.find(e => {
        if (!dClaim.action) return false;
        const data = e.data || {};
        return data.capability === dClaim.action || (data.capabilities && data.capabilities.includes(dClaim.action));
      });

      let finalState: EpistemicState = 'UNVERIFIED';
      let confidence = 0.4;
      const combinedProvenance = [...dClaim.provenance];

      if (capEvidence) {
        combinedProvenance.push({
          sourceType: 'STATIC',
          artifact: capEvidence.artifact,
          location: capEvidence.provenance?.file,
          collectorId: capEvidence.collectorId,
          evidenceId: capEvidence.id
        });

        // Check Evidence Strength against Critical Capability Policy
        const isCritical = dClaim.action && this.CRITICAL_ACTIONS.includes(dClaim.action);
        const strengthOrder: EvidenceStrength[] = [
          'DEPENDENCY_ONLY', 'IMPORT_OBSERVED', 'FUNCTION_DEFINED',
          'TOOL_REGISTERED', 'AGENT_BOUND', 'ENTRYPOINT_REACHABLE', 'RUNTIME_CONFIRMED'
        ];

        const strengthIndex = strengthOrder.indexOf(capEvidence.strength);
        const agentBoundIndex = strengthOrder.indexOf('AGENT_BOUND');

        if (isCritical && strengthIndex < agentBoundIndex) {
          // Rule: Weak static evidence on critical capability CANNOT yield SUPPORTED
          finalState = 'UNVERIFIED';
          confidence = 0.3;
          findings.push({
            id: `finding-unverified-crit-${dClaim.id}`,
            type: 'UNVERIFIED_CRITICAL_CLAIM',
            severity: 'HIGH',
            title: `Unverified Critical Claim: ${dClaim.action}`,
            description: `Declared critical capability ${dClaim.action} on resource "${dClaim.resource}" lacks required AGENT_BOUND evidence (Observed strength: ${capEvidence.strength}).`,
            declaredText: `Action ${dClaim.action} on ${dClaim.resource}`,
            observedText: `Evidence strength: ${capEvidence.strength}`,
            evidenceRefs: [capEvidence.id],
            provenance: { file: capEvidence.provenance?.file || dClaim.provenance[0]?.artifact || 'taidyup.yaml' }
          });
        } else {
          // Rule A: Compatible strong observation
          finalState = 'SUPPORTED';
          confidence = 0.85;
        }

        // Constraint Reconciliation: Check if declared constraint matches code observation
        if (dClaim.constraints && dClaim.constraints.approval_required && !capEvidence.data?.hasOversight) {
          findings.push({
            id: `finding-oversight-unverified-${dClaim.id}`,
            type: 'MISSING_OVERSIGHT_EVIDENCE',
            severity: 'MEDIUM',
            title: `Human Approval Unverified for ${dClaim.action}`,
            description: `Manifest declared human approval required for ${dClaim.action}, but static analysis could not observe human oversight implementation in code.`,
            declaredText: `approval_required: ${dClaim.constraints.approval_required}`,
            observedText: `Human oversight NOT_OBSERVED`,
            evidenceRefs: [capEvidence.id],
            provenance: { file: dClaim.provenance[0]?.artifact || 'taidyup.yaml' }
          });
        }
      } else {
        // Rule B: Declared but unverified
        finalState = 'UNVERIFIED';
        confidence = 0.4;
      }

      reconciledClaims.push({
        ...dClaim,
        status: finalState,
        confidence,
        provenance: combinedProvenance
      });
    }

    // Process Static Evidences for Undeclared Authority & Conflicts
    for (const ev of staticEvidences) {
      const data = ev.data || {};
      const capAction: CapabilityAction | undefined = data.capability;
      const resource: string = data.resource || ev.artifact;

      if (capAction) {
        const key = `${ev.subject}:${capAction}:${resource}`;

        // Check if declared in manifest
        const declaredMatch = declaredClaims.find(d => d.subject === ev.subject && d.action === capAction);

        if (!declaredMatch) {
          const isCritical = this.CRITICAL_ACTIONS.includes(capAction);
          const strengthOrder: EvidenceStrength[] = [
            'DEPENDENCY_ONLY', 'IMPORT_OBSERVED', 'FUNCTION_DEFINED',
            'TOOL_REGISTERED', 'AGENT_BOUND', 'ENTRYPOINT_REACHABLE', 'RUNTIME_CONFIRMED'
          ];
          const strengthIndex = strengthOrder.indexOf(ev.strength);
          const agentBoundIndex = strengthOrder.indexOf('AGENT_BOUND');

          if (strengthIndex >= agentBoundIndex) {
            // Rule D: Strong agent-bound observation not declared -> UNDECLARED_OBSERVATION
            reconciledClaims.push({
              id: `claim-undeclared-${ev.id}`,
              subject: ev.subject,
              predicate: 'CAN',
              action: capAction,
              resource,
              source: 'STATIC',
              status: 'UNDECLARED_OBSERVATION',
              confidence: 0.85,
              provenance: [{
                sourceType: 'STATIC',
                artifact: ev.artifact,
                location: ev.provenance?.file,
                collectorId: ev.collectorId,
                evidenceId: ev.id
              }]
            });

            if (isCritical) {
              findings.push({
                id: `finding-undeclared-crit-${ev.id}`,
                type: 'UNDECLARED_CRITICAL_CAPABILITY',
                severity: 'CRITICAL',
                title: `Undeclared Critical Capability: ${capAction}`,
                description: `Static scanner observed agent-bound critical capability ${capAction} on resource "${resource}" that was NOT declared in taidyup.yaml.`,
                declaredText: `No declaration for ${capAction}`,
                observedText: `Observed bound capability ${capAction} in code`,
                evidenceRefs: [ev.id],
                provenance: { file: ev.provenance?.file || ev.artifact }
              });
            }
          } else {
            // Rule E: Weak functionality signal not declared -> POTENTIAL_ONLY / OBSERVED
            reconciledClaims.push({
              id: `claim-potential-${ev.id}`,
              subject: ev.subject,
              predicate: 'CAN',
              action: capAction,
              resource,
              source: 'STATIC',
              status: 'OBSERVED',
              confidence: 0.3,
              provenance: [{
                sourceType: 'STATIC',
                artifact: ev.artifact,
                location: ev.provenance?.file,
                collectorId: ev.collectorId,
                evidenceId: ev.id
              }]
            });
          }
        }
      }
    }

    // Check for explicit CONFLICTS (e.g. Manifest says CANNOT or no capabilities, but code has AGENT_BOUND capability)
    for (const dClaim of declaredClaims) {
      if (dClaim.predicate === 'CANNOT' && dClaim.action) {
        const contradictoryEv = staticEvidences.find(e => e.subject === dClaim.subject && e.data?.capability === dClaim.action && (e.strength === 'AGENT_BOUND' || e.strength === 'ENTRYPOINT_REACHABLE'));
        if (contradictoryEv) {
          const claimIdx = reconciledClaims.findIndex(c => c.id === dClaim.id);
          if (claimIdx !== -1) {
            reconciledClaims[claimIdx].status = 'CONFLICT';
            reconciledClaims[claimIdx].confidence = 0.95;
          }

          findings.push({
            id: `finding-conflict-${dClaim.id}`,
            type: 'DECLARATION_CONFLICT',
            severity: 'CRITICAL',
            title: `Explicit Declaration Conflict: ${dClaim.action}`,
            description: `Manifest declared prohibition (CANNOT) for ${dClaim.action}, but static analysis observed active agent binding in code.`,
            declaredText: `CANNOT ${dClaim.action}`,
            observedText: `Bound ${dClaim.action} in ${contradictoryEv.provenance?.file}`,
            evidenceRefs: [contradictoryEv.id],
            provenance: { file: contradictoryEv.provenance?.file || 'taidyup.yaml' }
          });
        }
      }
    }

    // Summarize Results
    const summary = {
      totalClaims: reconciledClaims.length,
      supportedCount: reconciledClaims.filter(c => c.status === 'SUPPORTED').length,
      unverifiedCount: reconciledClaims.filter(c => c.status === 'UNVERIFIED').length,
      conflictCount: reconciledClaims.filter(c => c.status === 'CONFLICT').length,
      undeclaredCount: reconciledClaims.filter(c => c.status === 'UNDECLARED_OBSERVATION').length,
      unknownCount: reconciledClaims.filter(c => c.status === 'UNKNOWN').length,
      criticalFindingsCount: findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length
    };

    return {
      schemaVersion: '1.0.0',
      timestamp,
      summary,
      reconciledClaims,
      findings
    };
  }
}
