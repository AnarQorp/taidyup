import type { EpistemicState } from '../../trust-kernel/types.js';

const styles: Partial<Record<EpistemicState, string>> = {
  SUPPORTED: 'border-[#1E50C8]/40 bg-[#1E50C8]/10 text-[#1E50C8]',
  UNVERIFIED: 'border-[#D97706]/40 bg-[#FFFBEB] text-[#B45309]',
  CONFLICT: 'border-[#DC2626]/40 bg-[#FEF2F2] text-[#B91C1C]',
  UNDECLARED_OBSERVATION: 'border-[#6D28D9]/40 bg-[#F5F3FF] text-[#6D28D9]',
  UNKNOWN: 'border-[#5C6068]/30 bg-[#F3F4F6] text-[#4B5563]'
};

export function StateBadge({ state }: { state: EpistemicState }) {
  return <span className={`inline-flex rounded border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide shadow-2xs ${styles[state] || styles.UNKNOWN}`}>{state}</span>;
}
