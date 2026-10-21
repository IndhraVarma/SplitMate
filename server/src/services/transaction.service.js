import mongoose from 'mongoose';
import { PersonalTransaction } from '../models/PersonalTransaction.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, buildPageMeta } from '../utils/pagination.js';
import { containsRegex } from '../utils/regex.js';

/**
 * Personal ledger.
 *
 * BALANCE DEFINITION (also in the README): for any period,
 *     balance = SUM(income in period) - SUM(expenses in period)
 * It is a cash-flow figure for that window, not a running net worth. Group
 * expenses and settlements are deliberately excluded: fronting 4,000 rupees for
 * dinner is not personal spending of 4,000, and being repaid is not income.
 * A user who wants a group cost in their personal ledger adds it explicitly.
 */

/** Every query is scoped by `user`, which is how one user cannot read another's rows. */
function scope(userId) {
  return { user: new mongoose.Types.ObjectId(userId) };
}

function buildFilter(userId, query = {}) {
  const filter = scope(userId);
  if (query.type) filter.type = query.type;
  if (query.category) filter.category = query.category;
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = query.from;
    if (query.to) filter.date.$lte = endOfDay(query.to);
  }
  if (query.search) {
    const rx = containsRegex(query.search);
    filter.$or = [{ description: rx }, { notes: rx }];
  }
  return filter;
}

/** A `to` filter of 2026-03-31 should include everything that happened that day. */
function endOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export async function listTransactions(userId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = buildFilter(userId, query);
  const sortField = (query.sort || '-date').replace('-', '');
  const direction = (query.sort || '-date').startsWith('-') ? -1 : 1;
  const sort = { [sortField === 'amount' ? 'amountPaise' : 'date']: direction, _id: -1 };

  const [items, total] = await Promise.all([
    PersonalTransaction.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    PersonalTransaction.countDocuments(filter),
  ]);

  return {
    items: items.map(serialise),
    meta: buildPageMeta({ page, limit, total }),
  };
}

export async function getTransaction(userId, id) {
  const doc = await PersonalTransaction.findOne({ _id: id, ...scope(userId) }).lean();
  if (!doc) throw ApiError.notFound('That transaction does not exist.');
  return serialise(doc);
}

export async function createTransaction(userId, payload) {
  const doc = await PersonalTransaction.create({
    user: userId,
    type: payload.type,
    amountPaise: payload.amount,
    category: payload.category,
    description: payload.description || '',
    paymentMethod: payload.paymentMethod || 'other',
    date: payload.date,
    notes: payload.notes || '',
  });
  return serialise(doc.toObject());
}

export async function updateTransaction(userId, id, payload) {
  const updates = {};
  if (payload.type !== undefined) updates.type = payload.type;
  if (payload.amount !== undefined) updates.amountPaise = payload.amount;
  if (payload.category !== undefined) updates.category = payload.category;
  if (payload.description !== undefined) updates.description = payload.description;
  if (payload.paymentMethod !== undefined) updates.paymentMethod = payload.paymentMethod;
  if (payload.date !== undefined) updates.date = payload.date;
  if (payload.notes !== undefined) updates.notes = payload.notes;

  // The filter carries the owner, so a request for someone else's id simply
  // matches nothing and returns 404 - it never updates another user's row.
  const doc = await PersonalTransaction.findOneAndUpdate({ _id: id, ...scope(userId) }, updates, {
    new: true,
    runValidators: true,
  }).lean();
  if (!doc) throw ApiError.notFound('That transaction does not exist.');
  return serialise(doc);
}

export async function deleteTransaction(userId, id) {
  const doc = await PersonalTransaction.findOneAndDelete({ _id: id, ...scope(userId) }).lean();
  if (!doc) throw ApiError.notFound('That transaction does not exist.');
  return { id: String(doc._id) };
}

function serialise(doc) {
  return {
    id: String(doc._id || doc.id),
    type: doc.type,
    amountPaise: doc.amountPaise,
    category: doc.category,
    description: doc.description,
    paymentMethod: doc.paymentMethod,
    date: doc.date,
    notes: doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export { buildFilter, scope, endOfDay, serialise };
