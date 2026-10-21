import { formatMoney } from '../../utils/money.js';
import { titleCase } from '../../utils/format.js';

/**
 * One tooltip for every chart. Values arrive as rupee numbers for Recharts, so
 * they are converted back to paise before formatting - formatting is the only
 * place a non-integer is allowed near money.
 */
export default function ChartTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-surface-border bg-surface-overlay px-3 py-2 shadow-lift">
      {label !== undefined && (
        <p className="mb-1 text-xs font-medium text-ink-faint">
          {labelFormatter ? labelFormatter(label) : titleCase(String(label))}
        </p>
      )}
      <ul className="space-y-0.5">
        {payload.map((entry) => (
          <li key={entry.dataKey || entry.name} className="flex items-center gap-2 text-sm">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color || entry.payload?.fill }}
            />
            <span className="text-ink-muted">{titleCase(entry.name)}</span>
            <span className="tabular ml-auto font-semibold text-ink">
              {formatMoney(Math.round(entry.value * 100))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
