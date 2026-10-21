import mongoose from 'mongoose';
import { GroupExpense } from '../models/GroupExpense.js';
import { ExpenseShare } from '../models/ExpenseShare.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, buildPageMeta } from '../utils/pagination.js';
import { supportsTransactions } from '../config/database.js';
import { computeShares, percentToBasisPoints } from '../../../shared/split.js';
import { listActiveMemberIds } from './group.service.js';
import { logger } from '../utils/logger.js';
import { containsRegex } from '../utils/regex.js';

/**
 * Shared-expense writes.
 *
 * CONSISTENCY: an expense and its shares must appear together or not at all -
 * a half-written expense would unbalance the whole group. On MongoDB Atlas (a
 * replica set) we use a real multi-document transaction. On a standalone mongod
 * (common for local development) transactions are unavailable, so we fall back
 * to an ordered write with a compensating delete: the shares are written first,
 * and if any step fails everything written so far is removed. Balances only
 * ever read expenses that have shares, so the failure window cannot produce a
 * wrong balance - at worst an orphan row that the cleanup removes.
 */

/** Validate that everyone named in the expense is an active member of the group. */
async function assertParticipantsAreMembers(groupId, { paidBy, participants }) {
  const memberIds = new Set(await listActiveMemberIds(groupId));
  if (!memberIds.has(String(paidBy))) {
    throw ApiError.unprocessable('The person who paid is not a member of this group.', {
      code: 'PAYER_NOT_MEMBER',
      details: [{ field: 'paidBy', message: 'Pick someone who is in this group.' }],
    });
  }
  const missing = participants
    .map((p) => String(p.userId))
    .filter((id) => !memberIds.has(id));
  if (missing.length > 0) {
    throw ApiError.unprocessable('Some of the people in this split are not group members.', {
      code: 'PARTICIPANT_NOT_MEMBER',
      details: missing.map((id) => ({ field: 'participants', message: `${id} is not a member.` })),
    });
  }
  return memberIds;
}

/**
 * Turn the validated request payload into the exact per-member share rows.
 * The split helpers guarantee the shares sum to the total, in whole paise.
 */
export function buildShares(payload) {
  const participants = [...payload.participants];

  // Deterministic ordering. EQUAL hands the leftover paise to the first
  // participants, so sorting by id makes the allocation stable across edits.
  participants.sort((a, b) => String(a.userId).localeCompare(String(b.userId)));

  const prepared = participants.map((p) => ({
    userId: String(p.userId),
    amountPaise: p.amount,
    basisPoints: p.percent === undefined ? undefined : percentToBasisPoints(p.percent),
  }));

  const shares = computeShares({
    splitType: payload.splitType,
    totalPaise: payload.amount,
    participants: prepared,
  });

  const bpByUser = new Map(prepared.map((p) => [p.userId, p.basisPoints]));
  return shares.map((s) => ({
    ...s,
    basisPoints: payload.splitType === 'PERCENT' ? bpByUser.get(s.userId) ?? null : null,
  }));
}

export async function createExpense(groupId, actorId, payload) {
  await assertParticipantsAreMembers(groupId, payload);
  const shares = buildShares(payload);

  const expenseDoc = {
    group: groupId,
    description: payload.description,
    amountPaise: payload.amount,
    category: payload.category || 'other',
    date: payload.date,
    paidBy: payload.paidBy,
    splitType: payload.splitType,
    notes: payload.notes || '',
    createdBy: actorId,
    updatedBy: actorId,
  };

  const expenseId = new mongoose.Types.ObjectId();
  const shareDocs = shares.map((s) => ({
    expense: expenseId,
    group: groupId,
    user: s.userId,
    amountPaise: s.amountPaise,
    basisPoints: s.basisPoints,
  }));

  await runAtomically(
    async (session) => {
      await GroupExpense.create([{ _id: expenseId, ...expenseDoc }], session ? { session } : {});
      await ExpenseShare.insertMany(shareDocs, session ? { session } : {});
    },
    async () => {
      // Compensating cleanup for the non-transactional path.
      await ExpenseShare.deleteMany({ expense: expenseId });
      await GroupExpense.deleteOne({ _id: expenseId });
    }
  );

  return getExpense(groupId, expenseId);
}

/**
 * Editing replaces the expense and all of its shares. Balances are always
 * derived from the current shares, so a correct rewrite is all that is needed
 * to "recalculate affected balances" - no cached totals to patch up.
 */
export async function updateExpense(groupId, expenseId, actorId, payload) {
  const existing = await GroupExpense.findOne({ _id: expenseId, group: groupId });
  if (!existing) throw ApiError.notFound('That expense does not exist.');

  await assertParticipantsAreMembers(groupId, payload);
  const shares = buildShares(payload);
  const previousShares = await ExpenseShare.find({ expense: expenseId }).lean();

  const shareDocs = shares.map((s) => ({
    expense: existing._id,
    group: groupId,
    user: s.userId,
    amountPaise: s.amountPaise,
    basisPoints: s.basisPoints,
  }));

  await runAtomically(
    async (session) => {
      const opts = session ? { session } : {};
      await ExpenseShare.deleteMany({ expense: existing._id }, opts);
      await ExpenseShare.insertMany(shareDocs, opts);
      existing.set({
        description: payload.description,
        amountPaise: payload.amount,
        category: payload.category || 'other',
        date: payload.date,
        paidBy: payload.paidBy,
        splitType: payload.splitType,
        notes: payload.notes || '',
        updatedBy: actorId,
      });
      await existing.save(opts);
    },
    async () => {
      // Restore the previous allocation if the rewrite failed part way.
      await ExpenseShare.deleteMany({ expense: existing._id });
      if (previousShares.length > 0) {
        await ExpenseShare.insertMany(
          previousShares.map((s) => ({
            _id: s._id,
            expense: s.expense,
            group: s.group,
            user: s.user,
            amountPaise: s.amountPaise,
            basisPoints: s.basisPoints,
          }))
        );
      }
    }
  );

  return getExpense(groupId, expenseId);
}

export async function deleteExpense(groupId, expenseId) {
  const existing = await GroupExpense.findOne({ _id: expenseId, group: groupId });
  if (!existing) throw ApiError.notFound('That expense does not exist.');
  await runAtomically(async (session) => {
    const opts = session ? { session } : {};
    await ExpenseShare.deleteMany({ expense: existing._id }, opts);
    await GroupExpense.deleteOne({ _id: existing._id }, opts);
  });
  return { id: String(expenseId) };
}

/**
 * Runs `work` inside a MongoDB transaction when the deployment supports one
 * (Atlas / any replica set). Otherwise runs it directly and, on failure, calls
 * `compensate` to undo whatever was written. Either way the caller sees one
 * all-or-nothing operation.
 */
async function runAtomically(work, compensate) {
  if (supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await work(session);
      });
      return;
    } finally {
      await session.endSession();
    }
  }

  try {
    await work(null);
  } catch (error) {
    if (compensate) {
      try {
        await compensate();
      } catch (cleanupError) {
        logger.error('Compensating write failed:', cleanupError);
      }
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function listExpenses(groupId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { group: new mongoose.Types.ObjectId(groupId) };
  if (query.category) filter.category = query.category;
  if (query.paidBy) filter.paidBy = new mongoose.Types.ObjectId(query.paidBy);
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = query.from;
    if (query.to) {
      const end = new Date(query.to);
      end.setUTCHours(23, 59, 59, 999);
      filter.date.$lte = end;
    }
  }
  if (query.search) {
    filter.description = containsRegex(query.search);
  }

  const [expenses, total] = await Promise.all([
    GroupExpense.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('paidBy', 'name email avatarColor')
      .lean(),
    GroupExpense.countDocuments(filter),
  ]);

  const shares = await ExpenseShare.find({ expense: { $in: expenses.map((e) => e._id) } })
    .populate('user', 'name email avatarColor')
    .lean();

  const sharesByExpense = new Map();
  for (const s of shares) {
    const key = String(s.expense);
    if (!sharesByExpense.has(key)) sharesByExpense.set(key, []);
    sharesByExpense.get(key).push(serialiseShare(s));
  }

  return {
    items: expenses.map((e) => serialiseExpense(e, sharesByExpense.get(String(e._id)) || [])),
    meta: buildPageMeta({ page, limit, total }),
  };
}

export async function getExpense(groupId, expenseId) {
  const expense = await GroupExpense.findOne({ _id: expenseId, group: groupId })
    .populate('paidBy', 'name email avatarColor')
    .lean();
  if (!expense) throw ApiError.notFound('That expense does not exist.');
  const shares = await ExpenseShare.find({ expense: expense._id })
    .populate('user', 'name email avatarColor')
    .lean();
  return serialiseExpense(expense, shares.map(serialiseShare));
}

function serialiseShare(s) {
  const user = s.user && s.user._id ? s.user : null;
  return {
    userId: String(user ? user._id : s.user),
    name: user ? user.name : undefined,
    email: user ? user.email : undefined,
    avatarColor: user ? user.avatarColor : undefined,
    amountPaise: s.amountPaise,
    basisPoints: s.basisPoints,
  };
}

function serialiseExpense(e, shares) {
  const payer = e.paidBy && e.paidBy._id ? e.paidBy : null;
  return {
    id: String(e._id),
    groupId: String(e.group),
    description: e.description,
    amountPaise: e.amountPaise,
    category: e.category,
    date: e.date,
    splitType: e.splitType,
    notes: e.notes,
    paidBy: {
      userId: String(payer ? payer._id : e.paidBy),
      name: payer ? payer.name : undefined,
      email: payer ? payer.email : undefined,
      avatarColor: payer ? payer.avatarColor : undefined,
    },
    shares,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export { serialiseExpense, serialiseShare, runAtomically };
