import { Claim, ConfigurationIdentity, ConnectedSnapshotMetadata, Evidence } from './types.js';

export interface EvidenceLayerSelection {
  positive: Evidence[];
  applicableAbsence?: Evidence;
  diagnostics: string[];
}

function timestamp(value: string): number | undefined {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function snapshot(evidence: Evidence): ConnectedSnapshotMetadata | undefined {
  const value = evidence.data?.connectedSnapshot as Partial<ConnectedSnapshotMetadata> | undefined;
  if (evidence.sourceType !== 'CONNECTED' || !value || value.mode !== 'POINT_IN_TIME' ||
      typeof value.sourceInstance !== 'string' || !value.sourceInstance || typeof value.scope !== 'string' || !value.scope) return undefined;
  return value as ConnectedSnapshotMetadata;
}

function identity(evidence: Evidence): ConfigurationIdentity | undefined {
  if (evidence.sourceType === 'CONNECTED') {
    const current = snapshot(evidence);
    return current && { sourceInstance: current.sourceInstance, scope: current.scope };
  }
  const configured = evidence.data?.configurationIdentity as Partial<ConfigurationIdentity> | undefined;
  if (!configured || typeof configured.sourceInstance !== 'string' || typeof configured.scope !== 'string') return undefined;
  return configured as ConfigurationIdentity;
}

function sameIdentity(left: ConfigurationIdentity | undefined, right: ConfigurationIdentity | undefined): boolean {
  return Boolean(left && right && left.sourceInstance === right.sourceInstance && left.scope === right.scope);
}

function sameClaimFact(claim: Claim, evidence: Evidence): boolean {
  return evidence.subject === claim.subject && evidence.data?.capability === claim.action && evidence.data?.resource === claim.resource;
}

/** Provider-neutral selection for positive facts and explicit scoped absence. */
export class EvidenceLayerPolicy {
  static select(claim: Claim, evidences: Evidence[], isComparableFact: (evidence: Evidence) => boolean = evidence => sameClaimFact(claim, evidence)): EvidenceLayerSelection {
    const relevant = evidences.filter(evidence => (evidence.sourceType === 'STATIC' || evidence.sourceType === 'CONNECTED') && isComparableFact(evidence));
    const positive = relevant.filter(evidence => evidence.data?.observation !== 'ABSENCE_OBSERVED');
    const absences = relevant.filter(evidence => {
      if (evidence.data?.observation !== 'ABSENCE_OBSERVED') return false;
      const metadata = snapshot(evidence);
      return metadata?.retrievalStatus === 'SUCCESS' && metadata.completeness === 'COMPLETE' && timestamp(evidence.observedAt) !== undefined;
    });

    let applicableAbsence: Evidence | undefined;
    for (const absence of absences) {
      const absenceIdentity = identity(absence);
      const comparablePositive = positive.filter(item => sameIdentity(identity(item), absenceIdentity) && timestamp(item.observedAt) !== undefined);
      if (comparablePositive.length === 0) continue;
      const latestPositiveAt = Math.max(...comparablePositive.map(item => timestamp(item.observedAt)!));
      const absenceAt = timestamp(absence.observedAt)!;
      if (absenceAt < latestPositiveAt) continue;
      if (!applicableAbsence || absenceAt > timestamp(applicableAbsence.observedAt)!) applicableAbsence = absence;
    }

    const diagnostics: string[] = [];
    if (applicableAbsence) diagnostics.push('CURRENT_STATE_DRIFT', 'CONNECTED_ABSENCE_OBSERVED');
    if (relevant.some(evidence => evidence.sourceType === 'CONNECTED' && evidence.data?.observation === 'ABSENCE_OBSERVED' && !absences.includes(evidence))) diagnostics.push('INCOMPLETE_CONNECTED_SNAPSHOT');
    return { positive, applicableAbsence, diagnostics };
  }
}
