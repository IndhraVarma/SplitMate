import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import ChartTooltip from './ChartTooltip.jsx';
import { toChartValue, formatMoney } from '../../utils/money.js';
import { categoryColor, titleCase } from '../../utils/format.js';

/**
 * Spending by category as a donut, with a readable legend beside it. The legend
 * carries the real figures, so the chart never has to be squinted at.
 */
export default function CategoryChart({ categories = [], height = 240 }) {
  const data = categories.map((c) => ({
    name: c.category,
    value: toChartValue(c.totalPaise),
    totalPaise: c.totalPaise,
    shareBasisPoints: c.shareBasisPoints,
    fill: categoryColor(c.category),
  }));

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="w-full sm:w-1/2">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="86%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="w-full space-y-2 sm:w-1/2">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.fill }} />
            <span className="truncate text-ink-muted">{titleCase(entry.name)}</span>
            <span className="ml-auto shrink-0 text-xs text-ink-faint">
              {(entry.shareBasisPoints / 100).toFixed(0)}%
            </span>
            <span className="tabular w-24 shrink-0 text-right font-semibold text-ink">
              {formatMoney(entry.totalPaise)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
