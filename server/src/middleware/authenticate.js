import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/User.js';

/**
 * Token transport.
 *
 * The API is served from a different site than the SPA (Render vs Vercel), so a
 * session cookie would be a third-party cookie and is blocked by default in
 * Safari and increasingly in Chrome. SplitMate therefore uses a Bearer access
 * token as its primary transport, and ALSO sets a hardened cookie
 * (httpOnly, SameSite=None, Secure) for same-site or proxied deployments.
 * Either is accepted here. The trade-off is documented in the README.
 */
export function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  if (req.cookies && req.cookies.splitmate_token) return req.cookies.splitmate_token;
  return null;
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Your session has expired. Please sign in again.', {
        code: 'TOKEN_EXPIRED',
      });
    }
    throw ApiError.unauthorized('Invalid authentication token.', { code: 'TOKEN_INVALID' });
  }
}

/** Rejects the request unless a valid token maps to an existing user. */
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) {
    throw ApiError.unauthorized('You must be signed in to do that.', { code: 'TOKEN_MISSING' });
  }
  const payload = verifyToken(token);
  const user = await User.findById(payload.sub);
  if (!user) {
    // The token is well-formed but the account is gone (deleted, or a stale
    // token signed for a database that has since been reseeded).
    throw ApiError.unauthorized('Your account could not be found.', { code: 'USER_NOT_FOUND' });
  }
  req.user = user;
  req.userId = user._id.toString();
  next();
});

export default authenticate;
