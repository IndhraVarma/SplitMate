import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltip from './ChartTooltip.jsx';
import { toChartValue } from '../../utils/money.js';
import { formatShortDate } from '../../utils/format.js';

const AXIS = { stroke: '#8C9880', fontSize: 11, tickLine: false, axisLine: false };

/** Day-by-day spending for the current window. */
export default function DailyTrendChart({ days = [], height = 200 }) {
  const data = days.map((d) => ({
    date: d.date,
    expense: toChartValue(d.expensePaise),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6B8A47" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#6B8A47" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2EBCB" vertical={false} />
        <XAxis dataKey="date" {...AXIS} tickFormatter={formatShortDate} minTickGap={24} />
        <YAxis {...AXIS} width={52} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
        <Tooltip content={<ChartTooltip labelFormatter={formatShortDate} />} />
        <Area
          type="monotone"
          dataKey="expense"
          name="Spent"
          stroke="#6B8A47"
          strokeWidth={2}
          fill="url(#spendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
