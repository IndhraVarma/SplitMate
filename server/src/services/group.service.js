import mongoose from 'mongoose';
import { Group } from '../models/Group.js';
import { GroupMembership } from '../models/GroupMembership.js';
import { GroupExpense } from '../models/GroupExpense.js';
import { ExpenseShare } from '../models/ExpenseShare.js';
import { Settlement } from '../models/Settlement.js';
import { Invitation } from '../models/Invitation.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { computeNetBalances, summariseUserBalances } from '../../../shared/balance.js';

/**
 * AUTHORIZATION GATE for everything group-related.
 *
 * Every group route calls this first. A user who is not an ACTIVE member gets
 * 404 rather than 403, so changing an id in a URL cannot even confirm that a
 * given group exists.
 */
export async function requireMembership(groupId, userId, { roles } = {}) {
  const membership = await GroupMembership.findOne({
    group: groupId,
    user: userId,
    status: 'active',
  });
  if (!membership) {
    throw ApiError.notFound('That group does not exist, or you are not a member of it.', {
      code: 'NOT_A_MEMBER',
    });
  }
  if (roles && !roles.includes(membership.role)) {
    throw ApiError.forbidden('Only a group admin can do that.', { code: 'INSUFFICIENT_ROLE' });
  }
  const group = await Group.findById(groupId);
  if (!group) throw ApiError.notFound('That group does not exist.');
  return { group, membership };
}

export async function listActiveMemberIds(groupId) {
  const rows = await GroupMembership.find({ group: groupId, status: 'active' })
    .select('user')
    .lean();
  return rows.map((r) => String(r.user));
}

export async function createGroup(userId, payload) {
  const group = await Group.create({
    name: payload.name,
    description: payload.description || '',
    type: payload.type || 'other',
    accentColor: payload.accentColor || '#10b981',
    createdBy: userId,
  });

  // The creator is always an owner.
  await GroupMembership.create({ group: group._id, user: userId, role: 'owner' });

  const added = [];
  for (const memberId of payload.memberIds || []) {
    if (String(memberId) === String(userId)) continue;
    const user = await User.findById(memberId);
    if (!user) continue;
    await GroupMembership.updateOne(
      { group: group._id, user: user._id },
      { $set: { status: 'active', role: 'member', removedAt: null }, $setOnInsert: { joinedAt: new Date() } },
      { upsert: true }
    );
    added.push(user.toPublicJSON());
  }

  const invitations = [];
  for (const email of payload.inviteEmails || []) {
    invitations.push(await inviteByEmail(group._id, userId, email));
  }

  return { group: group.toJSON(), members: added, invitations };
}

export async function updateGroup(groupId, updates) {
  const patch = { ...updates };
  if (patch.archived !== undefined) {
    patch.archivedAt = patch.archived ? new Date() : null;
    delete patch.archived;
  }
  const group = await Group.findByIdAndUpdate(groupId, patch, { new: true, runValidators: true });
  if (!group) throw ApiError.notFound('That group does not exist.');
  return group.toJSON();
}

/**
 * Deleting a group removes every record that only makes sense inside it.
 * Only an owner may do this, and the route confirms before calling.
 */
export async function deleteGroup(groupId) {
  await Promise.all([
    ExpenseShare.deleteMany({ group: groupId }),
    GroupExpense.deleteMany({ group: groupId }),
    Settlement.deleteMany({ group: groupId }),
    GroupMembership.deleteMany({ group: groupId }),
    Invitation.deleteMany({ group: groupId }),
  ]);
  await Group.findByIdAndDelete(groupId);
  return { id: String(groupId) };
}

/** Groups the user belongs to, each with the user's own net balance in it. */
export async function listGroupsForUser(userId) {
  const memberships = await GroupMembership.find({ user: userId, status: 'active' })
    .populate('group')
    .lean();

  const groups = memberships.filter((m) => m.group).map((m) => ({ ...m.group, role: m.role }));
  if (groups.length === 0) {
    return { groups: [], totals: summariseUserBalances([]) };
  }

  const groupIds = groups.map((g) => g._id);
  const [expenses, settlements, memberRows] = await Promise.all([
    loadExpensesForGroups(groupIds),
    Settlement.find({ group: { $in: groupIds } }).lean(),
    GroupMembership.find({ group: { $in: groupIds }, status: 'active' })
      .select('group user')
      .populate('user', 'name avatarColor')
      .lean(),
  ]);

  const byGroup = (list, key) => {
    const map = new Map();
    for (const item of list) {
      const k = String(item[key]);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    }
    return map;
  };

  const expensesByGroup = byGroup(expenses, 'group');
  const settlementsByGroup = byGroup(settlements, 'group');
  const membersByGroup = byGroup(memberRows, 'group');

  const result = groups.map((g) => {
    const key = String(g._id);
    const groupMembers = membersByGroup.get(key) || [];
    const net = computeNetBalances({
      memberIds: groupMembers.map((m) => String(m.user && m.user._id ? m.user._id : m.user)),
      expenses: expensesByGroup.get(key) || [],
      settlements: (settlementsByGroup.get(key) || []).map(normaliseSettlement),
    });
    const groupExpenses = expensesByGroup.get(key) || [];
    return {
      id: key,
      name: g.name,
      description: g.description,
      type: g.type,
      accentColor: g.accentColor,
      archivedAt: g.archivedAt,
      role: g.role,
      createdAt: g.createdAt,
      memberCount: groupMembers.length,
      // A short member preview so the groups list can show avatars without a
      // second round-trip. Not the full membership - use GET /groups/:id for that.
      members: groupMembers
        .filter((m) => m.user && m.user._id)
        .slice(0, 5)
        .map((m) => ({
          userId: String(m.user._id),
          name: m.user.name,
          avatarColor: m.user.avatarColor,
        })),
      expenseCount: groupExpenses.length,
      totalExpensePaise: groupExpenses.reduce(
        (acc, e) => acc + e.shares.reduce((s, sh) => s + sh.amountPaise, 0),
        0
      ),
      myNetBalancePaise: net.get(String(userId)) || 0,
    };
  });

  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return {
    groups: result,
    totals: summariseUserBalances(result.map((g) => g.myNetBalancePaise)),
  };
}

/**
 * Loads expenses with their shares attached, in the shape shared/balance.js
 * expects: { paidBy, shares: [{ userId, amountPaise }] }.
 */
export async function loadExpensesForGroups(groupIds) {
  const ids = Array.isArray(groupIds) ? groupIds : [groupIds];
  const [expenses, shares] = await Promise.all([
    GroupExpense.find({ group: { $in: ids } }).lean(),
    ExpenseShare.find({ group: { $in: ids } }).lean(),
  ]);
  const sharesByExpense = new Map();
  for (const s of shares) {
    const key = String(s.expense);
    if (!sharesByExpense.has(key)) sharesByExpense.set(key, []);
    sharesByExpense.get(key).push({ userId: String(s.user), amountPaise: s.amountPaise, basisPoints: s.basisPoints });
  }
  return expenses.map((e) => ({
    ...e,
    id: String(e._id),
    group: String(e.group),
    paidBy: String(e.paidBy),
    shares: sharesByExpense.get(String(e._id)) || [],
  }));
}

export function normaliseSettlement(s) {
  return {
    id: String(s._id),
    group: String(s.group),
    fromUser: String(s.fromUser),
    toUser: String(s.toUser),
    amountPaise: s.amountPaise,
    method: s.method,
    note: s.note,
    settledAt: s.settledAt,
    recordedBy: String(s.recordedBy),
    createdAt: s.createdAt,
  };
}

export const oid = (id) => new mongoose.Types.ObjectId(id);

/* ------------------------------------------------------------------ *
 * Membership and invitations
 * ------------------------------------------------------------------ */

export async function listMembers(groupId) {
  const rows = await GroupMembership.find({ group: groupId })
    .populate('user', 'name email avatarColor')
    .sort({ status: 1, joinedAt: 1 })
    .lean();
  return rows
    .filter((r) => r.user)
    .map((r) => ({
      id: String(r._id),
      userId: String(r.user._id),
      name: r.user.name,
      email: r.user.email,
      avatarColor: r.user.avatarColor,
      role: r.role,
      status: r.status,
      joinedAt: r.joinedAt,
    }));
}

/**
 * Add a registered user to the group. Re-adding someone who was removed flips
 * their existing membership back to active, which preserves the history their
 * old expense shares point at.
 */
export async function addMember(groupId, { userId, email }) {
  const user = userId
    ? await User.findById(userId)
    : await User.findOne({ email: String(email).toLowerCase().trim() });

  if (!user) {
    throw ApiError.notFound(
      'No SplitMate account matches that person. Invite them by email instead.',
      { code: 'USER_NOT_REGISTERED' }
    );
  }

  const existing = await GroupMembership.findOne({ group: groupId, user: user._id });
  if (existing && existing.status === 'active') {
    throw ApiError.conflict('That person is already in this group.', { code: 'ALREADY_MEMBER' });
  }
  if (existing) {
    existing.status = 'active';
    existing.removedAt = null;
    existing.joinedAt = new Date();
    await existing.save();
  } else {
    await GroupMembership.create({ group: groupId, user: user._id, role: 'member' });
  }
  return user.toPublicJSON();
}

/**
 * Removing a member is only allowed once they are square with the group.
 * Removing someone who still owes (or is owed) money would silently drop that
 * obligation from every balance, so we refuse and say why.
 */
export async function removeMember(groupId, targetUserId, actingUserId) {
  const membership = await GroupMembership.findOne({
    group: groupId,
    user: targetUserId,
    status: 'active',
  });
  if (!membership) throw ApiError.notFound('That person is not a member of this group.');
  if (membership.role === 'owner' && String(targetUserId) !== String(actingUserId)) {
    throw ApiError.forbidden('The group owner cannot be removed.');
  }

  const [expenses, settlements, memberIds] = await Promise.all([
    loadExpensesForGroups(groupId),
    Settlement.find({ group: groupId }).lean(),
    listActiveMemberIds(groupId),
  ]);
  const net = computeNetBalances({
    memberIds,
    expenses,
    settlements: settlements.map(normaliseSettlement),
  });
  if ((net.get(String(targetUserId)) || 0) !== 0) {
    throw ApiError.conflict(
      'That member still has an outstanding balance. Settle up before removing them.',
      { code: 'MEMBER_HAS_BALANCE' }
    );
  }

  if (membership.role === 'owner' && memberIds.length > 1) {
    throw ApiError.conflict('Transfer ownership before leaving, or delete the group instead.', {
      code: 'OWNER_MUST_TRANSFER',
    });
  }

  membership.status = 'removed';
  membership.removedAt = new Date();
  await membership.save();
  return { userId: String(targetUserId) };
}

/**
 * Create (or refresh) an invitation for an email address.
 *
 * No email is sent - SplitMate has no mail provider configured. The caller
 * receives a token and shares the join link themselves. This is an honest
 * limitation, documented in the README rather than faked.
 */
export async function inviteByEmail(groupId, invitedBy, email) {
  const normalised = String(email).toLowerCase().trim();

  const existingUser = await User.findOne({ email: normalised });
  if (existingUser) {
    const membership = await GroupMembership.findOne({
      group: groupId,
      user: existingUser._id,
      status: 'active',
    });
    if (membership) {
      throw ApiError.conflict('That person is already in this group.', { code: 'ALREADY_MEMBER' });
    }
  }

  // Only one live invitation per address per group.
  await Invitation.updateMany(
    { group: groupId, email: normalised, status: 'pending' },
    { $set: { status: 'revoked' } }
  );

  const invitation = await Invitation.create({
    group: groupId,
    email: normalised,
    invitedBy,
    token: Invitation.generateToken(),
  });

  return {
    id: String(invitation._id),
    email: invitation.email,
    token: invitation.token,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    isRegisteredUser: Boolean(existingUser),
  };
}

export async function listInvitations(groupId) {
  const rows = await Invitation.find({ group: groupId, status: 'pending' })
    .sort({ createdAt: -1 })
    .lean();
  return rows.map((r) => ({
    id: String(r._id),
    email: r.email,
    token: r.token,
    status: r.status,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
  }));
}

export async function revokeInvitation(groupId, invitationId) {
  const invitation = await Invitation.findOneAndUpdate(
    { _id: invitationId, group: groupId, status: 'pending' },
    { $set: { status: 'revoked' } },
    { new: true }
  );
  if (!invitation) throw ApiError.notFound('That invitation does not exist.');
  return { id: String(invitation._id) };
}

/**
 * Redeem an invitation token. The signed-in user's email must match the
 * address the invitation was issued to, so a leaked token cannot be used by
 * someone else to read a private group.
 */
export async function acceptInvitation(token, user) {
  const invitation = await Invitation.findOne({ token, status: 'pending' });
  if (!invitation) {
    throw ApiError.notFound('That invitation is not valid or has already been used.', {
      code: 'INVITATION_INVALID',
    });
  }
  if (invitation.expiresAt < new Date()) {
    invitation.status = 'revoked';
    await invitation.save();
    throw ApiError.badRequest('That invitation has expired. Ask for a new one.', {
      code: 'INVITATION_EXPIRED',
    });
  }
  if (invitation.email !== user.email) {
    throw ApiError.forbidden('This invitation was sent to a different email address.', {
      code: 'INVITATION_EMAIL_MISMATCH',
    });
  }

  await GroupMembership.updateOne(
    { group: invitation.group, user: user._id },
    {
      $set: { status: 'active', removedAt: null },
      $setOnInsert: { role: 'member', joinedAt: new Date() },
    },
    { upsert: true }
  );

  invitation.status = 'accepted';
  invitation.acceptedBy = user._id;
  invitation.acceptedAt = new Date();
  await invitation.save();

  const group = await Group.findById(invitation.group);
  return { group: group ? group.toJSON() : null };
}

/** Pending invitations addressed to the signed-in user, across all groups. */
export async function listMyInvitations(user) {
  const rows = await Invitation.find({ email: user.email, status: 'pending' })
    .populate('group', 'name description type accentColor')
    .sort({ createdAt: -1 })
    .lean();
  return rows
    .filter((r) => r.group)
    .map((r) => ({
      id: String(r._id),
      token: r.token,
      expiresAt: r.expiresAt,
      group: {
        id: String(r.group._id),
        name: r.group.name,
        description: r.group.description,
        type: r.group.type,
        accentColor: r.group.accentColor,
      },
    }));
}
