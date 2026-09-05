import {
  BindingAssessment,
  CapabilityAction,
  Claim,
  ClaimMatchAssessment,
  ComponentLocator,
  DimensionAssessment,
  EpistemicState,
  Evidence,
  EvidenceStrength,
  ReconciledTrustState,
  ReconciliationOptions,
  ResourceDescriptor,
  ResourceRelation,
  SubjectBindingAssertion,
  TechnicalFinding
} from './types.js';
import { EvidenceLayerPolicy } from './evidenceLayerPolicy.js';

const STRENGTH_ORDER: EvidenceStrength[] = [
  'DEPENDENCY_ONLY', 'IMPORT_OBSERVED', 'FUNCTION_DEFINED',
  'TOOL_REGISTERED', 'AGENT_BOUND', 'ENTRYPOINT_REACHABLE', 'RUNTIME_CONFIRMED'
];

interface SubjectAssessmentResult {
  dimension: DimensionAssessment;
  binding: BindingAssessment;
  diagnostics: string[];
}

function parseDescriptor(value: unknown): ResourceDescriptor | undefined {
  if (value && typeof value === 'object') {
    const candidate = value as Partial<ResourceDescriptor>;
    if ([candidate.namespace, candidate.version, candidate.type, candidate.scope, candidate.artifact].every(item => typeof item === 'string' && item.length > 0)) {
      return candidate as ResourceDescriptor;
    }
  }
  if (typeof value !== 'string' || !value.trim().startsWith('{')) return undefined;
  try {
    return parseDescriptor(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function sameLocator(left: ComponentLocator, right: ComponentLocator): boolean {
  return left.scheme === right.scheme &&
    left.version === right.version &&
    left.revision === right.revision &&
    left.language === right.language &&
    left.module === right.module &&
    left.qualifiedSymbol === right.qualifiedSymbol &&
    left.structuralFingerprint === right.structuralFingerprint;
}

function assessSubject(declaredSubject: string, evidence: Evidence | undefined, assertions: SubjectBindingAssertion[]): SubjectAssessmentResult {
  if (evidence?.subject === declaredSubject) {
    return { dimension: 'SATISFIED', binding: 'EVIDENCE_BOUND', diagnostics: [] };
  }

  const assertion = assertions.find(item => item.declaredSubject === declaredSubject);
  if (!assertion) return { dimension: 'UNVERIFIED', binding: 'UNBOUND', diagnostics: [] };
  if (!evidence) return { dimension: 'UNVERIFIED', binding: 'UNBOUND', diagnostics: ['BINDING_REQUIRED'] };

  const matches = evidence.data?.componentMatches;
  if (Array.isArray(matches) && matches.length > 1) {
    return { dimension: 'UNVERIFIED', binding: 'AMBIGUOUS', diagnostics: ['BINDING_REQUIRED'] };
  }

  const expected = assertion.observedComponent;
  if (!expected.structuralFingerprint) {
    return { dimension: 'UNVERIFIED', binding: 'OWNER_ASSERTED', diagnostics: ['BINDING_REQUIRED'] };
  }

  const observed = evidence.data?.componentLocator as ComponentLocator | undefined;
  if (!observed) return { dimension: 'UNVERIFIED', binding: 'OWNER_ASSERTED', diagnostics: ['BINDING_REQUIRED'] };
  if (!sameLocator(expected, observed)) {
    return { dimension: 'UNVERIFIED', binding: 'STALE', diagnostics: ['BINDING_REQUIRED'] };
  }
  if (evidence.data?.capabilityPathBound !== true) {
    return { dimension: 'UNVERIFIED', binding: 'OWNER_ASSERTED', diagnostics: ['BINDING_REQUIRED'] };
  }
  return { dimension: 'SATISFIED', binding: 'EVIDENCE_BOUND', diagnostics: [] };
}

function assessResource(claim: Claim, evidence: Evidence | undefined): { dimension: DimensionAssessment; relation: ResourceRelation; diagnostics: string[] } {
  if (!claim.resource || !evidence) return { dimension: 'UNVERIFIED', relation: 'UNRESOLVED', diagnostics: [] };

  const declaredDescriptor = claim.resourceDescriptor || parseDescriptor(claim.resource);
  const observedDescriptor = parseDescriptor(evidence.data?.resourceDescriptor);

  if (declaredDescriptor && observedDescriptor) {
    const sameBase = declaredDescriptor.namespace === observedDescriptor.namespace &&
      declaredDescriptor.version === observedDescriptor.version &&
      declaredDescriptor.type === observedDescriptor.type &&
      declaredDescriptor.scope === observedDescriptor.scope;
    if (sameBase && declaredDescriptor.artifact === observedDescriptor.artifact) {
      return { dimension: 'SATISFIED', relation: 'EXACT', diagnostics: [] };
    }
    if (!sameBase) return { dimension: 'UNVERIFIED', relation: 'DISJOINT', diagnostics: [] };
    if (declaredDescriptor.artifact === 'all-files' && observedDescriptor.artifact === 'selected-files') {
      return { dimension: 'UNVERIFIED', relation: 'NARROWER_THAN', diagnostics: [] };
    }
    if (declaredDescriptor.artifact === 'selected-files' && observedDescriptor.artifact === 'all-files') {
      return { dimension: 'UNVERIFIED', relation: 'BROADER_THAN', diagnostics: ['POSSIBLE_AUTHORITY_EXCESS'] };
    }
    return { dimension: 'UNVERIFIED', relation: 'DISJOINT', diagnostics: [] };
  }

  // Legacy exact is deliberately narrow: both sides must lack contradictory
  // structured descriptors and carry the exact same opaque identifier.
  if (!declaredDescriptor && !observedDescriptor && claim.resource === evidence.data?.resource) {
    return { dimension: 'SATISFIED', relation: 'EXACT', diagnostics: ['LEGACY_EXACT'] };
  }
  return { dimension: 'UNVERIFIED', relation: 'UNRESOLVED', diagnostics: [] };
}

function assessConstraints(claim: Claim, evidence: Evidence | undefined): Record<string, DimensionAssessment> {
  const result: Record<string, DimensionAssessment> = {};
  for (const [key, declaredValue] of Object.entries(claim.constraints || {})) {
    const observed = evidence?.data?.constraintEvidence?.[key];
    if (!observed || observed.sameCapabilityPath !== true) {
      result[key] = 'UNVERIFIED';
    } else if (observed.value === declaredValue) {
      result[key] = 'SATISFIED';
    } else if (observed.mode === 'EXPLICIT_OPPOSITE') {
      result[key] = 'CONTRADICTED';
    } else {
      result[key] = 'UNVERIFIED';
    }
  }
  return result;
}

function hasSufficientStrength(action: CapabilityAction | undefined, evidence: Evidence | undefined, criticalActions: CapabilityAction[]): boolean {
  if (!action || !evidence) return false;
  if (!criticalActions.includes(action)) return true;
  return STRENGTH_ORDER.indexOf(evidence.strength) >= STRENGTH_ORDER.indexOf('AGENT_BOUND');
}

export class ReconciliationEngine {
  public static ENGINE_VERSION = '1.2.0';

  private static CRITICAL_ACTIONS: CapabilityAction[] = [
    'DELETE', 'EXECUTE', 'SEND', 'PUBLISH', 'APPROVE', 'PURCHASE', 'TRANSFER', 'ADMIN'
  ];

  public static reconcile(inputClaims: Claim[], inputEvidences: Evidence[], options: ReconciliationOptions = {}): ReconciledTrustState {
    const timestamp = new Date().toISOString();
    const reconciledClaims: Claim[] = [];
    const findings: TechnicalFinding[] = [];
    const declaredClaims = inputClaims.filter(claim => claim.source === 'DECLARATION');
    const reconcilableEvidences = inputEvidences.filter(evidence => evidence.sourceType === 'STATIC' || evidence.sourceType === 'CONNECTED');
    const assertions = options.subjectBindings || [];

    for (const declared of declaredClaims) {
      const actionCandidates = declared.action
        ? reconcilableEvidences.filter(evidence => evidence.data?.observation !== 'ABSENCE_OBSERVED' && (evidence.data?.capability === declared.action || evidence.data?.capabilities?.includes(declared.action)))
        : [];

      const ranked = actionCandidates.map(evidence => {
        const subject = assessSubject(declared.subject, evidence, assertions);
        const resource = assessResource(declared, evidence);
        const score = (subject.dimension === 'SATISFIED' ? 4 : subject.binding === 'OWNER_ASSERTED' ? 2 : 0) +
          (resource.relation === 'EXACT' ? 2 : resource.relation === 'NARROWER_THAN' || resource.relation === 'BROADER_THAN' ? 1 : 0);
        return { evidence, subject, resource, score };
      }).sort((left, right) => right.score - left.score);

      const selection = EvidenceLayerPolicy.select(declared, reconcilableEvidences, evidence => {
        if (evidence.data?.capability !== declared.action) return false;
        const subject = assessSubject(declared.subject, evidence, assertions);
        const resource = assessResource(declared, evidence);
        return subject.dimension === 'SATISFIED' && resource.relation === 'EXACT';
      });

      const candidate = ranked[0];
      const evidence = candidate?.evidence;
      const subject = candidate?.subject || assessSubject(declared.subject, undefined, assertions);
      const resource = candidate?.resource || assessResource(declared, undefined);
      const rawConstraints = assessConstraints(declared, evidence);
      const constraints = subject.dimension === 'SATISFIED' && resource.dimension === 'SATISFIED'
        ? rawConstraints
        : Object.fromEntries(Object.keys(rawConstraints).map(key => [key, 'UNVERIFIED' as DimensionAssessment]));
      const predicate: DimensionAssessment = !declared.action
        ? 'UNVERIFIED'
        : declared.predicate === 'CAN'
          ? 'SATISFIED'
          : declared.predicate === 'CANNOT' && subject.dimension === 'SATISFIED' && resource.dimension === 'SATISFIED'
            ? 'CONTRADICTED'
            : 'UNVERIFIED';
      const action: DimensionAssessment = evidence ? 'SATISFIED' : 'UNVERIFIED';
      const strengthSatisfied = hasSufficientStrength(declared.action, evidence, this.CRITICAL_ACTIONS);
      const anyConstraintContradicted = Object.values(constraints).includes('CONTRADICTED');
      const allConstraintsSatisfied = Object.values(constraints).every(value => value === 'SATISFIED');
      const dimensionsSatisfied = !selection.applicableAbsence && subject.dimension === 'SATISFIED' && predicate === 'SATISFIED' &&
        action === 'SATISFIED' && resource.dimension === 'SATISFIED' && allConstraintsSatisfied && strengthSatisfied;

      let overall: EpistemicState = 'UNVERIFIED';
      if (anyConstraintContradicted || predicate === 'CONTRADICTED') overall = 'CONFLICT';
      else if (dimensionsSatisfied) overall = 'SUPPORTED';

      const diagnostics = [...subject.diagnostics, ...resource.diagnostics, ...selection.diagnostics];
      const compatiblePositiveRefs = ranked
        .filter(item => item.subject.dimension === 'SATISFIED' && item.resource.relation === 'EXACT')
        .map(item => item.evidence.id);
      const hasConnectedForClaim = selection.positive.some(item => item.sourceType === 'CONNECTED') || Boolean(selection.applicableAbsence);
      const evidenceRefs = hasConnectedForClaim
        ? Array.from(new Set([...compatiblePositiveRefs, ...(selection.applicableAbsence ? [selection.applicableAbsence.id] : [])]))
        : evidence ? [evidence.id] : [];
      const assessment: ClaimMatchAssessment = {
        overall,
        subject: subject.dimension,
        predicate,
        action,
        resource: resource.dimension,
        resourceRelation: resource.relation,
        constraints,
        binding: subject.binding,
        evidenceRefs,
        diagnostics: Array.from(new Set(diagnostics))
      };

      const provenance = [...declared.provenance];
      for (const selected of reconcilableEvidences.filter(item => evidenceRefs.includes(item.id))) provenance.push({
        sourceType: selected.sourceType, artifact: selected.artifact, location: selected.provenance?.file,
        collectorId: selected.collectorId, evidenceId: selected.id
      });

      reconciledClaims.push({
        ...declared,
        status: overall,
        confidence: overall === 'CONFLICT' ? 0.95 : overall === 'SUPPORTED' ? 0.85 : strengthSatisfied && evidence ? 0.4 : 0.3,
        provenance,
        assessment
      });

      if (declared.action && evidence && !strengthSatisfied && this.CRITICAL_ACTIONS.includes(declared.action)) {
        findings.push({
          id: `finding-unverified-crit-${declared.id}`,
          type: 'UNVERIFIED_CRITICAL_CLAIM', severity: 'HIGH', title: `Unverified Critical Claim: ${declared.action}`,
          description: `Declared critical capability ${declared.action} on resource "${declared.resource}" lacks required AGENT_BOUND evidence (Observed strength: ${evidence.strength}).`,
          declaredText: `Action ${declared.action} on ${declared.resource}`, observedText: `Evidence strength: ${evidence.strength}`,
          evidenceRefs: [evidence.id], provenance: { file: evidence.provenance?.file || declared.provenance[0]?.artifact || 'taidyup.json' }
        });
      }

      if (declared.constraints?.approval_required && constraints.approval_required === 'UNVERIFIED') {
        findings.push({
          id: `finding-oversight-unverified-${declared.id}`,
          type: 'MISSING_OVERSIGHT_EVIDENCE', severity: 'MEDIUM', title: `Human Approval Unverified for ${declared.action}`,
          description: `Manifest declared human approval required for ${declared.action}, but evidence tied to the same capability path does not verify that constraint.`,
          declaredText: `approval_required: ${declared.constraints.approval_required}`, observedText: 'Approval policy UNVERIFIED',
          evidenceRefs: evidence ? [evidence.id] : [], provenance: { file: declared.provenance[0]?.artifact || 'taidyup.json' }
        });
      }

      if (overall === 'CONFLICT' && declared.action) {
        findings.push({
          id: `finding-conflict-${declared.id}`,
          type: 'DECLARATION_CONFLICT', severity: 'CRITICAL', title: `Explicit Declaration Conflict: ${declared.action}`,
          description: `Evidence bound to the same subject, capability and resource contradicts the declaration.`,
          declaredText: `${declared.predicate} ${declared.action} ${declared.resource}`,
          observedText: 'Bound contradictory evidence', evidenceRefs: evidence ? [evidence.id] : [],
          provenance: { file: evidence?.provenance?.file || declared.provenance[0]?.artifact || 'taidyup.json' }
        });
      }
    }

    for (const evidence of reconcilableEvidences.filter(item => item.data?.observation !== 'ABSENCE_OBSERVED')) {
      const action: CapabilityAction | undefined = evidence.data?.capability;
      if (!action) continue;
      const resource = evidence.data?.resource || evidence.artifact;
      const covered = declaredClaims.some(declared => {
        if (declared.action !== action) return false;
        const subject = assessSubject(declared.subject, evidence, assertions);
        const resourceAssessment = assessResource(declared, evidence);
        return subject.dimension === 'SATISFIED' && resourceAssessment.relation === 'EXACT';
      });
      if (covered) continue;

      const strong = STRENGTH_ORDER.indexOf(evidence.strength) >= STRENGTH_ORDER.indexOf('AGENT_BOUND');
      reconciledClaims.push({
        id: `${strong ? 'claim-undeclared' : 'claim-potential'}-${evidence.id}`,
        subject: evidence.subject, predicate: 'CAN', action, resource, source: evidence.sourceType,
        status: strong ? 'UNDECLARED_OBSERVATION' : 'OBSERVED', confidence: strong ? 0.85 : 0.3,
        provenance: [{ sourceType: evidence.sourceType, artifact: evidence.artifact, location: evidence.provenance?.file, collectorId: evidence.collectorId, evidenceId: evidence.id }]
      });

      if (strong && this.CRITICAL_ACTIONS.includes(action)) {
        findings.push({
          id: `finding-undeclared-crit-${evidence.id}`,
          type: 'UNDECLARED_CRITICAL_CAPABILITY', severity: 'CRITICAL', title: `Undeclared Critical Capability: ${action}`,
          description: `${evidence.sourceType === 'CONNECTED' ? 'Connected source reported' : 'Static scanner observed'} agent-bound critical capability ${action} on resource "${resource}" without a fully bound declaration.`,
          declaredText: `No bound declaration for ${action}`, observedText: `${evidence.sourceType === 'CONNECTED' ? 'Connected current-state' : 'Observed code'} evidence reports bound capability ${action}`,
          evidenceRefs: [evidence.id], provenance: { file: evidence.provenance?.file || evidence.artifact }
        });
      }
    }

    const summary = {
      totalClaims: reconciledClaims.length,
      supportedCount: reconciledClaims.filter(claim => claim.status === 'SUPPORTED').length,
      unverifiedCount: reconciledClaims.filter(claim => claim.status === 'UNVERIFIED').length,
      conflictCount: reconciledClaims.filter(claim => claim.status === 'CONFLICT').length,
      undeclaredCount: reconciledClaims.filter(claim => claim.status === 'UNDECLARED_OBSERVATION').length,
      unknownCount: reconciledClaims.filter(claim => claim.status === 'UNKNOWN').length,
      criticalFindingsCount: findings.filter(finding => finding.severity === 'CRITICAL' || finding.severity === 'HIGH').length
    };

    return { schemaVersion: '1.1.0', timestamp, summary, reconciledClaims, findings };
  }
}
