import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartTooltip from './ChartTooltip.jsx';
import { toChartValue } from '../../utils/money.js';

const AXIS = { stroke: '#8C9880', fontSize: 11, tickLine: false, axisLine: false };

/** Income vs expense per month. Two bars, one axis, no decoration. */
export default function TrendChart({ months = [], height = 260 }) {
  const data = months.map((m) => ({
    label: m.label,
    income: toChartValue(m.incomePaise),
    expense: toChartValue(m.expensePaise),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2EBCB" vertical={false} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} width={56} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F2F7E4' }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: '#5E6B50', paddingTop: 8 }}
        />
        <Bar dataKey="income" name="Income" fill="#6B8A47" radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="expense" name="Expense" fill="#D1403F" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}
