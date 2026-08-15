import { ReconciledTrustState } from '../trust-kernel/types.js';

export interface AuthorityDiffResult {
  baseTimestamp: string;
  targetTimestamp: string;
  newAgents: string[];
  removedAgents: string[];
  addedCapabilities: string[];
  removedCapabilities: string[];
  criticalExpansions: string[];
  summaryText: string;
}

export class DiffEngine {
  /**
   * Compares two ReconciledTrustState artifacts and computes semantic Authority Diff.
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
    const criticalExpansions = addedCapabilities.filter(cap => {
      const parts = cap.split(':');
      return criticalActions.includes(parts[1]);
    });

    const lines: string[] = [];
    lines.push(`TAIDYUP AUTHORITY DIFF`);
    lines.push(`Base:   ${baseState.timestamp}`);
    lines.push(`Target: ${targetState.timestamp}\n`);

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
      lines.push(`\n🚨 CRITICAL AUTHORITY EXPANSION DETECTED:`);
      criticalExpansions.forEach(c => lines.push(`  💥 ${c}`));
    }

    if (addedCapabilities.length === 0 && removedCapabilities.length === 0 && newAgents.length === 0 && removedAgents.length === 0) {
      lines.push(`No structural authority changes detected between releases.`);
    }

    return {
      baseTimestamp: baseState.timestamp,
      targetTimestamp: targetState.timestamp,
      newAgents,
      removedAgents,
      addedCapabilities,
      removedCapabilities,
      criticalExpansions,
      summaryText: lines.join('\n')
    };
  }
}
