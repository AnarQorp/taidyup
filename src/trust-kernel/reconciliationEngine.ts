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
  RuntimeAssessment,
  RuntimeEvidenceData,
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
    const runtimeInput = inputEvidences.filter(evidence => evidence.sourceType === 'RUNTIME');
    const runtimeIdentity = new Map<string, Evidence>();
    const runtimeSetDiagnostics: string[] = [];
    for (const evidence of runtimeInput) {
      const data = evidence.data as RuntimeEvidenceData;
      const key = `${data.source?.identity}\u0000${data.sourceEventId}`;
      const prior = runtimeIdentity.get(key);
      if (!prior) runtimeIdentity.set(key, evidence);
      else if (prior.sha256 === evidence.sha256) runtimeSetDiagnostics.push('DUPLICATE_RUNTIME_EVENT');
      else runtimeSetDiagnostics.push('RUNTIME_EVENT_ID_CONFLICT');
    }
    const runtimeEvidences = [...runtimeIdentity.values()];
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

    const isBoundRuntime = (evidence: Evidence): boolean => {
      const data = evidence.data as RuntimeEvidenceData;
      return data.bindings?.subject?.state === 'BOUND' && data.bindings?.action?.state === 'BOUND' &&
        (!data.operation.resource || data.bindings?.resource?.state === 'BOUND');
    };
    const isOccurrence = (evidence: Evidence): boolean => ['EXECUTION_STARTED', 'EXECUTION_COMPLETED', 'RESULT_OBSERVED'].includes((evidence.data as RuntimeEvidenceData).eventKind);
    const runtimeMatches = (claim: Claim, evidence: Evidence): boolean => {
      const data = evidence.data as RuntimeEvidenceData;
      if (!isBoundRuntime(evidence) || data.bindings.subject.value !== claim.subject || data.operation.action !== claim.action) return false;
      if (claim.resource && data.operation.resource !== claim.resource) return false;
      for (const [key, value] of Object.entries(claim.constraints || {})) {
        if (data.operation.constraints?.[key] !== value || data.bindings.constraints.state !== 'BOUND') return false;
      }
      return true;
    };
    const buildRuntimeAssessment = (events: Evidence[]): RuntimeAssessment => {
      if (events.length === 0) return { observationState: 'NO_OBSERVATION', observedCount: 0, observedExecutionInstances: 0, observedEvents: 0, completeness: 'NO_OBSERVATION', binding: 'UNBOUND', evidenceRefs: [], diagnostics: [] };
      const ordered = [...events].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
      const diagnostics = new Set<string>(['RUNTIME_PARTIAL_OBSERVATION', ...runtimeSetDiagnostics]);
      const byRun = new Map<string, Evidence[]>();
      for (const event of events) {
        const data = event.data as RuntimeEvidenceData;
        const run = data.runId || data.observationScope.id;
        byRun.set(run, [...(byRun.get(run) || []), event]);
      }
      for (const runEvents of byRun.values()) {
        const kinds = new Set(runEvents.map(item => (item.data as RuntimeEvidenceData).eventKind));
        const completions = runEvents.filter(item => (item.data as RuntimeEvidenceData).eventKind === 'EXECUTION_COMPLETED');
        if (kinds.has('EXECUTION_COMPLETED') && !kinds.has('EXECUTION_STARTED')) diagnostics.add('RUNTIME_START_MISSING');
        if (kinds.has('EXECUTION_STARTED') && !kinds.has('EXECUTION_COMPLETED')) diagnostics.add('RUNTIME_COMPLETION_MISSING');
        if (kinds.has('INVOCATION_ATTEMPTED') && !kinds.has('EXECUTION_STARTED')) diagnostics.add('RUNTIME_ATTEMPT_ONLY');
        if (completions.length > 1) diagnostics.add('RUNTIME_MULTIPLE_COMPLETIONS');
        if (new Set(completions.map(item => (item.data as RuntimeEvidenceData).outcome)).size > 1) diagnostics.add('RUNTIME_CONTRADICTORY_OUTCOMES');
        const chronological = [...runEvents].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
        const rank: Record<string, number> = { INVOCATION_ATTEMPTED: 0, EXECUTION_STARTED: 1, EXECUTION_COMPLETED: 2, RESULT_OBSERVED: 3 };
        for (let index = 1; index < chronological.length; index++) {
          const before = chronological[index - 1]; const after = chronological[index];
          if (before.observedAt === after.observedAt) diagnostics.add('RUNTIME_TIME_TIE');
          if (rank[(before.data as RuntimeEvidenceData).eventKind] > rank[(after.data as RuntimeEvidenceData).eventKind]) diagnostics.add('RUNTIME_TIMESTAMP_INVERSION');
        }
      }
      const kinds = new Set(events.map(item => (item.data as RuntimeEvidenceData).eventKind));
      const observationState = kinds.has('RESULT_OBSERVED') ? 'RESULT_OBSERVED' : kinds.has('EXECUTION_COMPLETED') ? 'COMPLETION_OBSERVED' : kinds.has('EXECUTION_STARTED') ? 'START_OBSERVED' : 'ATTEMPT_OBSERVED';
      const latestTime = ordered.at(-1)!.observedAt;
      const latestCandidates = ordered.filter(item => item.observedAt === latestTime);
      if (latestCandidates.length > 1) diagnostics.add('RUNTIME_LATEST_EVENT_AMBIGUOUS');
      const latest = latestCandidates.length === 1 ? latestCandidates[0] : undefined;
      const completed = ordered.filter(item => (item.data as RuntimeEvidenceData).eventKind === 'EXECUTION_COMPLETED');
      const lastCompletionTime = completed.at(-1)?.observedAt;
      const lastCompletions = lastCompletionTime ? completed.filter(item => item.observedAt === lastCompletionTime) : [];
      if (lastCompletions.length > 1) diagnostics.add('RUNTIME_LATEST_OUTCOME_AMBIGUOUS');
      const latestOutcome = lastCompletions.length === 1 ? (lastCompletions[0].data as RuntimeEvidenceData).outcome : undefined;
      const bindingStates = events.map(item => isBoundRuntime(item));
      const binding = bindingStates.every(Boolean) ? 'BOUND' : bindingStates.some(Boolean) ? 'PARTIAL' : 'UNBOUND';
      return {
        observationState, latestEvent: latest ? (latest.data as RuntimeEvidenceData).eventKind : undefined, latestOutcome,
        observedCount: byRun.size, observedExecutionInstances: byRun.size, observedEvents: events.length,
        observationWindow: { startedAt: ordered[0].observedAt, endedAt: latestTime },
        completeness: 'PARTIAL_OBSERVATION', binding, evidenceRefs: events.map(item => item.id),
        diagnostics: [...diagnostics], lastObservedAt: latestTime
      };
    };

    for (const claim of reconciledClaims) {
      const matches = runtimeEvidences.filter(evidence => runtimeMatches(claim, evidence));
      claim.runtimeAssessment = buildRuntimeAssessment(matches);
      if (claim.predicate === 'CANNOT' && matches.some(evidence => isOccurrence(evidence))) {
        claim.status = 'CONFLICT';
        if (claim.assessment) {
          claim.assessment.overall = 'CONFLICT';
          claim.assessment.predicate = 'CONTRADICTED';
          claim.assessment.evidenceRefs = Array.from(new Set([...claim.assessment.evidenceRefs, ...matches.map(item => item.id)]));
          claim.assessment.diagnostics = Array.from(new Set([...claim.assessment.diagnostics, 'RUNTIME_EXPLICIT_PROHIBITION_CONFLICT']));
        }
        claim.provenance.push(...matches.map(item => ({ sourceType: 'RUNTIME' as const, artifact: item.artifact, location: item.location, collectorId: item.collectorId, evidenceId: item.id })));
        if (!findings.some(item => item.id === `finding-conflict-${claim.id}`)) findings.push({
          id: `finding-conflict-${claim.id}`, type: 'DECLARATION_CONFLICT', severity: 'CRITICAL',
          title: `Explicit Declaration Conflict: ${claim.action}`,
          description: 'Observed runtime activity bound to the same subject, capability and resource conflicts with an explicit declaration.',
          declaredText: `${claim.predicate} ${claim.action} ${claim.resource}`,
          observedText: 'Runtime occurrence observed; authorization, safety and compliance are not established.',
          evidenceRefs: matches.map(item => item.id), provenance: { file: matches[0].provenance.file }
        });
      }
    }

    const unboundRuntimeObservations = runtimeEvidences.filter(evidence => !isBoundRuntime(evidence));
    const runtimeOccurrenceGroups = new Map<string, Evidence[]>();
    for (const evidence of runtimeEvidences.filter(evidence => isBoundRuntime(evidence) && isOccurrence(evidence))) {
      const data = evidence.data as RuntimeEvidenceData;
      if (declaredClaims.some(claim => runtimeMatches(claim, evidence))) continue;
      const key = `${data.bindings.subject.value}\u0000${data.operation.action}\u0000${data.operation.resource || ''}`;
      runtimeOccurrenceGroups.set(key, [...(runtimeOccurrenceGroups.get(key) || []), evidence]);
    }
    for (const events of runtimeOccurrenceGroups.values()) {
      const evidence = events[0]; const data = evidence.data as RuntimeEvidenceData;
      const existing = reconciledClaims.find(claim => claim.source === 'RUNTIME' && claim.subject === data.bindings.subject.value && claim.action === data.operation.action && claim.resource === data.operation.resource);
      if (existing) continue;
      const id = `claim-undeclared-runtime-${evidence.id}`;
      reconciledClaims.push({
        id, subject: data.bindings.subject.value!, predicate: 'CAN', action: data.operation.action,
        resource: data.operation.resource, source: 'RUNTIME', status: 'UNDECLARED_OBSERVATION', confidence: 0.85,
        provenance: events.map(item => ({ sourceType: 'RUNTIME', artifact: item.artifact, location: item.location, collectorId: item.collectorId, evidenceId: item.id })),
        runtimeAssessment: buildRuntimeAssessment(events)
      });
      if (this.CRITICAL_ACTIONS.includes(data.operation.action)) findings.push({
        id: `finding-undeclared-runtime-${evidence.id}`, type: 'UNDECLARED_CRITICAL_CAPABILITY', severity: 'CRITICAL',
        title: `Undeclared Runtime Observation: ${data.operation.action}`,
        description: `Runtime activity for ${data.operation.action} was observed without a matching owner declaration. Authorization, safety and compliance are not established.`,
        declaredText: `No bound declaration for ${data.operation.action}`, observedText: 'Bound runtime occurrence observed',
        evidenceRefs: events.map(item => item.id), provenance: { file: evidence.provenance.file }
      });
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

    return { schemaVersion: '1.2.0', timestamp, summary, reconciledClaims, findings, unboundRuntimeObservations };
  }
}
