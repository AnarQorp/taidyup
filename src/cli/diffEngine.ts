import { ReconciledTrustState } from '../trust-kernel/types.js';

export interface AuthorityDiffResult {
  baseTimestamp: string;
  targetTimestamp: string;
  newAgents: string[];
  removedAgents: string[];
  addedCapabilities: string[];
  removedCapabilities: string[];
  criticalExpansions: string[];
  declarationContextChange?: { from: 'PRESENT' | 'ABSENT'; to: 'PRESENT' | 'ABSENT' };
  summaryText: string;
}

export class DiffEngine {
  /**
   * Compares two ReconciledTrustState artifacts and computes a structural capability-evidence diff.
   */
  public static computeDiff(baseState: ReconciledTrustState, targetState: ReconciledTrustState): AuthorityDiffResult {
    const baseSubjects = new Set(baseState.reconciledClaims.map(c => c.subject));
    const targetSubjects = new Set(targetState.reconciledClaims.map(c => c.subject));

    const newAgents = Array.from(targetSubjects).filter(s => !baseSubjects.has(s));
    const removedAgents = Array.from(baseSubjects).filter(s => !targetSubjects.has(s));

    const baseCaps = new Set(baseState.reconciledClaims.filter(c => c.action).map(c => `${c.subject}:${c.action}:${c.resource}`));
    const targetCaps = new Set(targetState.reconciledClaims.filter(c => c.action).map(c => `${c.subject}:${c.action}:${c.resource}`));

    const addedCapabilities = Array.from(targetCaps).filter(c => !baseCaps.has(c));
    const removedCapabilities = Array.from(baseCaps).filter(c => !targetCaps.has(c));

    const criticalActions = ['DELETE', 'EXECUTE', 'SEND', 'PUBLISH', 'APPROVE', 'PURCHASE', 'TRANSFER', 'ADMIN'];
    const criticalTargetCapabilities = new Set(targetState.reconciledClaims
      .filter(claim => claim.action && criticalActions.includes(claim.action))
      .map(claim => `${claim.subject}:${claim.action}:${claim.resource}`));
    const criticalExpansions = addedCapabilities.filter(capability => criticalTargetCapabilities.has(capability));
    const baseDeclaration = baseState.declarationContext?.status ?? 'PRESENT';
    const targetDeclaration = targetState.declarationContext?.status ?? 'PRESENT';
    const declarationContextChange = baseDeclaration === targetDeclaration ? undefined : { from: baseDeclaration, to: targetDeclaration };

    const lines: string[] = [];
    lines.push(`TAIDYUP CAPABILITY EVIDENCE DIFF`);
    lines.push(`Base:   ${baseState.timestamp}`);
    lines.push(`Target: ${targetState.timestamp}\n`);
    if (declarationContextChange) lines.push(`[DECLARATION CONTEXT] ${declarationContextChange.from} -> ${declarationContextChange.to}`);

    if (newAgents.length > 0) lines.push(`[NEW AGENTS]        + ${newAgents.join(', ')}`);
    if (removedAgents.length > 0) lines.push(`[REMOVED AGENTS]    - ${removedAgents.join(', ')}`);
    if (addedCapabilities.length > 0) {
      lines.push(`[NEW CAPABILITIES]`);
      addedCapabilities.forEach(c => lines.push(`  + ${c}`));
    }
    if (removedCapabilities.length > 0) {
      lines.push(`[REMOVED CAPABILITIES]`);
      removedCapabilities.forEach(c => lines.push(`  - ${c}`));
    }
    if (criticalExpansions.length > 0) {
      lines.push(`\n⚠️ CRITICAL CAPABILITY EVIDENCE ADDED:`);
      criticalExpansions.forEach(c => lines.push(`  💥 ${c}`));
    }

    if (addedCapabilities.length === 0 && removedCapabilities.length === 0 && newAgents.length === 0 && removedAgents.length === 0) {
      lines.push(`No structural capability evidence changes detected between releases.`);
    }

    return {
      baseTimestamp: baseState.timestamp,
      targetTimestamp: targetState.timestamp,
      newAgents,
      removedAgents,
      addedCapabilities,
      removedCapabilities,
      criticalExpansions,
      declarationContextChange,
      summaryText: lines.join('\n')
    };
  }
}
