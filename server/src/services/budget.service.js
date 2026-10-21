import mongoose from 'mongoose';
import { Budget } from '../models/Budget.js';
import { PersonalTransaction } from '../models/PersonalTransaction.js';
import { ApiError } from '../utils/ApiError.js';
import { startOfMonthUTC, endOfMonthUTC, currentPeriod } from '../utils/dates.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/**
 * Budgets are per (user, year, month, category). Setting one is an upsert, so
 * the "Set budget" form is naturally idempotent and a duplicate submit updates
 * the limit instead of raising a duplicate-key error.
 */
export async function upsertBudget(userId, { category, year, month, limit }) {
  const budget = await Budget.findOneAndUpdate(
    { user: userId, category, year, month },
    { $set: { limitPaise: limit } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  return serialise(budget);
}

export async function deleteBudget(userId, id) {
  const doc = await Budget.findOneAndDelete({ _id: id, user: userId }).lean();
  if (!doc) throw ApiError.notFound('That budget does not exist.');
  return { id: String(doc._id) };
}

/**
 * Budgets for a month joined with what was actually spent in each category.
 * Returns one row per budget, plus an overall roll-up.
 */
export async function getBudgetSummary(userId, { year, month } = {}) {
  const period = currentPeriod();
  const y = year || period.year;
  const m = month || period.month;
  const start = startOfMonthUTC(y, m);
  const end = endOfMonthUTC(y, m);

  const [budgets, spendRows] = await Promise.all([
    Budget.find({ user: userId, year: y, month: m }).sort({ category: 1 }).lean(),
    PersonalTransaction.aggregate([
      { $match: { user: oid(userId), type: 'expense', date: { $gte: start, $lte: end } } },
      { $group: { _id: '$category', spentPaise: { $sum: '$amountPaise' } } },
    ]),
  ]);

  const spentByCategory = new Map(spendRows.map((r) => [r._id, r.spentPaise]));

  const items = budgets.map((b) => {
    const spentPaise = spentByCategory.get(b.category) || 0;
    const remainingPaise = b.limitPaise - spentPaise;
    return {
      id: String(b._id),
      category: b.category,
      year: b.year,
      month: b.month,
      limitPaise: b.limitPaise,
      spentPaise,
      remainingPaise,
      // Progress in basis points so the UI never divides money itself.
      usedBasisPoints: b.limitPaise > 0 ? Math.round((spentPaise / b.limitPaise) * 10000) : 0,
      isOverBudget: spentPaise > b.limitPaise,
    };
  });

  // Categories with spending but no budget set - useful prompts in the UI.
  const budgetedCategories = new Set(budgets.map((b) => b.category));
  const unbudgeted = spendRows
    .filter((r) => !budgetedCategories.has(r._id))
    .map((r) => ({ category: r._id, spentPaise: r.spentPaise }))
    .sort((a, b) => b.spentPaise - a.spentPaise);

  const totalLimitPaise = items.reduce((acc, i) => acc + i.limitPaise, 0);
  const totalBudgetedSpendPaise = items.reduce((acc, i) => acc + i.spentPaise, 0);

  return {
    year: y,
    month: m,
    items,
    unbudgetedSpending: unbudgeted,
    totals: {
      totalLimitPaise,
      totalSpentPaise: totalBudgetedSpendPaise,
      remainingPaise: totalLimitPaise - totalBudgetedSpendPaise,
      usedBasisPoints:
        totalLimitPaise > 0 ? Math.round((totalBudgetedSpendPaise / totalLimitPaise) * 10000) : 0,
      overBudgetCount: items.filter((i) => i.isOverBudget).length,
    },
  };
}

function serialise(b) {
  return {
    id: String(b._id),
    category: b.category,
    year: b.year,
    month: b.month,
    limitPaise: b.limitPaise,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}
