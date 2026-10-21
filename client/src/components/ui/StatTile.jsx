import { formatMoney } from '../../utils/money.js';

/**
 * A single headline number. `tone` colours only the value, never the whole
 * card, so a screen of tiles stays calm.
 */
export default function StatTile({ label, amountPaise, tone = 'neutral', hint, icon, className = '' }) {
  const toneClass = {
    neutral: 'text-ink',
    positive: 'text-positive',
    negative: 'text-negative',
    accent: 'text-accent',
  }[tone];

  return (
    <div className={`card p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
        {icon}
      </div>
      <p className={`tabular mt-2 text-xl font-bold sm:text-2xl ${toneClass}`}>
        {formatMoney(amountPaise ?? 0)}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
