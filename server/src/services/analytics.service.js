import mongoose from 'mongoose';
import { PersonalTransaction } from '../models/PersonalTransaction.js';
import { startOfMonthUTC, endOfMonthUTC, startOfYearUTC, endOfYearUTC } from '../utils/dates.js';

/**
 * Aggregations for the dashboard and analytics screens.
 *
 * All sums are over integer paise inside MongoDB, so no floating point is
 * involved anywhere in the pipeline.
 */

const oid = (id) => new mongoose.Types.ObjectId(id);

function periodRange({ year, month, from, to }) {
  if (from || to) {
    const start = from || new Date(0);
    const end = to ? new Date(new Date(to).setUTCHours(23, 59, 59, 999)) : new Date();
    return { start, end };
  }
  const now = new Date();
  const y = year || now.getUTCFullYear();
  if (month) return { start: startOfMonthUTC(y, month), end: endOfMonthUTC(y, month) };
  return { start: startOfYearUTC(y), end: endOfYearUTC(y) };
}

/** Totals for a window: income, expense, and the cash-flow balance between them. */
export async function getSummary(userId, query = {}) {
  const { start, end } = periodRange(query);
  const rows = await PersonalTransaction.aggregate([
    { $match: { user: oid(userId), date: { $gte: start, $lte: end } } },
    { $group: { _id: '$type', totalPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
  ]);

  const income = rows.find((r) => r._id === 'income');
  const expense = rows.find((r) => r._id === 'expense');
  const totalIncomePaise = income ? income.totalPaise : 0;
  const totalExpensePaise = expense ? expense.totalPaise : 0;

  return {
    periodStart: start,
    periodEnd: end,
    totalIncomePaise,
    totalExpensePaise,
    balancePaise: totalIncomePaise - totalExpensePaise,
    incomeCount: income ? income.count : 0,
    expenseCount: expense ? expense.count : 0,
    savingsRateBasisPoints:
      totalIncomePaise > 0
        ? Math.round(((totalIncomePaise - totalExpensePaise) / totalIncomePaise) * 10000)
        : null,
  };
}

/** Spending split by category for a window, largest first. */
export async function getCategoryBreakdown(userId, query = {}) {
  const { start, end } = periodRange(query);
  const rows = await PersonalTransaction.aggregate([
    { $match: { user: oid(userId), type: 'expense', date: { $gte: start, $lte: end } } },
    { $group: { _id: '$category', totalPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
    { $sort: { totalPaise: -1 } },
  ]);
  const total = rows.reduce((acc, r) => acc + r.totalPaise, 0);
  return {
    periodStart: start,
    periodEnd: end,
    totalPaise: total,
    categories: rows.map((r) => ({
      category: r._id,
      totalPaise: r.totalPaise,
      count: r.count,
      // Share of spend in basis points, so the UI never has to divide money.
      shareBasisPoints: total > 0 ? Math.round((r.totalPaise / total) * 10000) : 0,
    })),
  };
}

/** Month-by-month income/expense trend for a calendar year. */
export async function getMonthlyTrend(userId, { year } = {}) {
  const y = year || new Date().getUTCFullYear();
  const rows = await PersonalTransaction.aggregate([
    { $match: { user: oid(userId), date: { $gte: startOfYearUTC(y), $lte: endOfYearUTC(y) } } },
    {
      $group: {
        _id: { month: { $month: { date: '$date', timezone: 'UTC' } }, type: '$type' },
        totalPaise: { $sum: '$amountPaise' },
      },
    },
  ]);

  const months = Array.from({ length: 12 }, (_, i) => ({
    year: y,
    month: i + 1,
    label: new Date(Date.UTC(y, i, 1)).toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }),
    incomePaise: 0,
    expensePaise: 0,
    balancePaise: 0,
  }));

  for (const row of rows) {
    const bucket = months[row._id.month - 1];
    if (row._id.type === 'income') bucket.incomePaise = row.totalPaise;
    else bucket.expensePaise = row.totalPaise;
  }
  for (const m of months) m.balancePaise = m.incomePaise - m.expensePaise;

  return { year: y, months };
}

/** Daily totals, used for the sparkline/trend chart on the dashboard. */
export async function getDailyTrend(userId, query = {}) {
  const { start, end } = periodRange(query);
  const rows = await PersonalTransaction.aggregate([
    { $match: { user: oid(userId), date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: {
          day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' } },
          type: '$type',
        },
        totalPaise: { $sum: '$amountPaise' },
      },
    },
    { $sort: { '_id.day': 1 } },
  ]);

  const byDay = new Map();
  for (const row of rows) {
    const day = row._id.day;
    if (!byDay.has(day)) byDay.set(day, { date: day, incomePaise: 0, expensePaise: 0 });
    const bucket = byDay.get(day);
    if (row._id.type === 'income') bucket.incomePaise = row.totalPaise;
    else bucket.expensePaise = row.totalPaise;
  }
  return { periodStart: start, periodEnd: end, days: [...byDay.values()] };
}

/** Breakdown by payment method, for the analytics screen. */
export async function getPaymentMethodBreakdown(userId, query = {}) {
  const { start, end } = periodRange(query);
  const rows = await PersonalTransaction.aggregate([
    { $match: { user: oid(userId), type: 'expense', date: { $gte: start, $lte: end } } },
    { $group: { _id: '$paymentMethod', totalPaise: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
    { $sort: { totalPaise: -1 } },
  ]);
  return rows.map((r) => ({ method: r._id, totalPaise: r.totalPaise, count: r.count }));
}

export { periodRange };
