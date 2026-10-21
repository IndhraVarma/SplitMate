import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { containsRegex, startsWithRegex } from '../utils/regex.js';

const AVATAR_COLORS = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899'];

function pickAvatarColor(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function issueToken(user) {
  return jwt.sign({ sub: user._id.toString() }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: 'splitmate',
  });
}

export async function registerUser({ name, email, password }) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw ApiError.conflict('An account with that email already exists.', {
      code: 'EMAIL_TAKEN',
      details: [{ field: 'email', message: 'This email is already registered.' }],
    });
  }
  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    name,
    email,
    passwordHash,
    avatarColor: pickAvatarColor(email),
    lastLoginAt: new Date(),
  });
  return { user, token: issueToken(user) };
}

export async function loginUser({ email, password }) {
  // The hash is select:false on the model, so it must be requested explicitly.
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message and same work for "no such user" and "wrong password", so the
  // response cannot be used to enumerate which emails are registered.
  const invalid = ApiError.unauthorized('Email or password is incorrect.', {
    code: 'INVALID_CREDENTIALS',
  });
  if (!user) {
    await User.hashPassword(password).catch(() => null);
    throw invalid;
  }
  const ok = await user.verifyPassword(password);
  if (!ok) throw invalid;

  user.lastLoginAt = new Date();
  await user.save();
  return { user, token: issueToken(user) };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('Account not found.');
  const ok = await user.verifyPassword(currentPassword);
  if (!ok) {
    throw ApiError.unauthorized('Your current password is incorrect.', {
      code: 'INVALID_CREDENTIALS',
      details: [{ field: 'currentPassword', message: 'That password is not correct.' }],
    });
  }
  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();
  return user;
}

export async function updateProfile(userId, updates) {
  const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('Account not found.');
  return user;
}

/** Look up registered users by exact email - used when adding group members. */
export async function findUserByEmail(email) {
  return User.findOne({ email: String(email).toLowerCase().trim() });
}

/**
 * Directory search for the "add member" picker. Deliberately requires a
 * reasonably specific query and returns only public fields, so the endpoint
 * cannot be scraped for the whole user list.
 */
export async function searchUsers(query, { excludeIds = [], limit = 10 } = {}) {
  const q = String(query || '').trim();
  if (q.length < 3) return [];
  const users = await User.find({
    _id: { $nin: excludeIds },
    $or: [{ email: startsWithRegex(q) }, { name: containsRegex(q) }],
  })
    .limit(limit)
    .sort({ name: 1 });
  return users.map((u) => u.toPublicJSON());
}
