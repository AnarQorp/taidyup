import type { EpistemicState } from '../../trust-kernel/types.js';

const styles: Partial<Record<EpistemicState, string>> = {
  SUPPORTED: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  UNVERIFIED: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  CONFLICT: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
  UNDECLARED_OBSERVATION: 'border-violet-400/40 bg-violet-400/10 text-violet-200',
  UNKNOWN: 'border-slate-400/40 bg-slate-400/10 text-slate-200'
};

export function StateBadge({ state }: { state: EpistemicState }) {
  return <span className={`inline-flex rounded border px-2 py-1 font-mono text-[10px] ${styles[state] || styles.UNKNOWN}`}>{state}</span>;
}
