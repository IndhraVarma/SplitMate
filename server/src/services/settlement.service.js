import mongoose from 'mongoose';
import { Settlement } from '../models/Settlement.js';
import { ApiError } from '../utils/ApiError.js';
import { getPagination, buildPageMeta } from '../utils/pagination.js';
import { listActiveMemberIds, normaliseSettlement } from './group.service.js';
import { User } from '../models/User.js';

/**
 * Settlements.
 *
 * A settlement records that one member reimbursed another. It is NOT a
 * payment - SplitMate never moves real money, and nothing here talks to a bank
 * or a payment processor.
 *
 * Partial settlements are ordinary: the amount is free-form and simply reduces
 * the outstanding balance between the two members.
 */
export async function createSettlement(groupId, actorId, payload) {
  const memberIds = new Set(await listActiveMemberIds(groupId));
  for (const [field, id] of [
    ['fromUser', payload.fromUser],
    ['toUser', payload.toUser],
  ]) {
    if (!memberIds.has(String(id))) {
      throw ApiError.unprocessable('Both people in a settlement must be members of this group.', {
        code: 'NOT_A_MEMBER',
        details: [{ field, message: 'That person is not in this group.' }],
      });
    }
  }

  // DUPLICATE SUBMIT PROTECTION: if the client sent this idempotency key
  // before, return the settlement it already created rather than recording the
  // repayment twice.
  if (payload.clientRequestId) {
    const existing = await Settlement.findOne({
      group: groupId,
      clientRequestId: payload.clientRequestId,
    }).lean();
    if (existing) {
      return { settlement: await decorate(normaliseSettlement(existing)), duplicate: true };
    }
  }

  const doc = {
    group: groupId,
    fromUser: payload.fromUser,
    toUser: payload.toUser,
    amountPaise: payload.amount,
    method: payload.method || 'other',
    note: payload.note || '',
    settledAt: payload.settledAt || new Date(),
    recordedBy: actorId,
    clientRequestId: payload.clientRequestId || null,
  };

  try {
    const created = await Settlement.create(doc);
    return { settlement: await decorate(normaliseSettlement(created.toObject())), duplicate: false };
  } catch (error) {
    // Two concurrent submits with the same key: the unique index rejects the
    // loser, and we hand back the winner instead of surfacing an error.
    if (error.code === 11000 && payload.clientRequestId) {
      const existing = await Settlement.findOne({
        group: groupId,
        clientRequestId: payload.clientRequestId,
      }).lean();
      if (existing) {
        return { settlement: await decorate(normaliseSettlement(existing)), duplicate: true };
      }
    }
    throw error;
  }
}

export async function listSettlements(groupId, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const filter = { group: new mongoose.Types.ObjectId(groupId) };
  if (query.userId) {
    const userObjectId = new mongoose.Types.ObjectId(query.userId);
    filter.$or = [{ fromUser: userObjectId }, { toUser: userObjectId }];
  }

  const [rows, total] = await Promise.all([
    Settlement.find(filter)
      .sort({ settledAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('fromUser', 'name email avatarColor')
      .populate('toUser', 'name email avatarColor')
      .lean(),
    Settlement.countDocuments(filter),
  ]);

  return {
    items: rows.map(serialisePopulated),
    meta: buildPageMeta({ page, limit, total }),
  };
}

/**
 * Deleting a settlement is how a mistaken entry is corrected. Only the person
 * who recorded it, or a group admin, may do so - enforced in the route.
 */
export async function deleteSettlement(groupId, settlementId) {
  const doc = await Settlement.findOneAndDelete({ _id: settlementId, group: groupId }).lean();
  if (!doc) throw ApiError.notFound('That settlement does not exist.');
  return { id: String(doc._id) };
}

export async function getSettlement(groupId, settlementId) {
  const doc = await Settlement.findOne({ _id: settlementId, group: groupId }).lean();
  if (!doc) throw ApiError.notFound('That settlement does not exist.');
  return doc;
}

function serialisePopulated(s) {
  const person = (u) =>
    u && u._id
      ? { userId: String(u._id), name: u.name, email: u.email, avatarColor: u.avatarColor }
      : { userId: String(u) };
  return {
    id: String(s._id),
    groupId: String(s.group),
    from: person(s.fromUser),
    to: person(s.toUser),
    amountPaise: s.amountPaise,
    method: s.method,
    note: s.note,
    settledAt: s.settledAt,
    recordedBy: String(s.recordedBy),
    createdAt: s.createdAt,
  };
}

async function decorate(settlement) {
  const users = await User.find({ _id: { $in: [settlement.fromUser, settlement.toUser] } })
    .select('name email avatarColor')
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const person = (id) => {
    const u = byId.get(String(id));
    return u
      ? { userId: String(id), name: u.name, email: u.email, avatarColor: u.avatarColor }
      : { userId: String(id) };
  };
  return {
    id: settlement.id,
    groupId: settlement.group,
    from: person(settlement.fromUser),
    to: person(settlement.toUser),
    amountPaise: settlement.amountPaise,
    method: settlement.method,
    note: settlement.note,
    settledAt: settlement.settledAt,
    recordedBy: settlement.recordedBy,
    createdAt: settlement.createdAt,
  };
}
