import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/apiResponse.js';
import { config } from '../config/env.js';
import * as authService from '../services/auth.service.js';

const COOKIE_NAME = 'splitmate_token';

/**
 * The token is returned in the body (the SPA sends it as a Bearer header) AND
 * mirrored into a hardened cookie for deployments where the API and the client
 * share a site. See middleware/authenticate.js for why both exist.
 */
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export const register = asyncHandler(async (req, res) => {
  const { user, token } = await authService.registerUser(req.body);
  setAuthCookie(res, token);
  return sendCreated(res, { user: user.toPublicJSON(), token }, { message: 'Welcome to SplitMate.' });
});

export const login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.loginUser(req.body);
  setAuthCookie(res, token);
  return sendSuccess(res, { user: user.toPublicJSON(), token }, { message: 'Signed in.' });
});

export const logout = asyncHandler(async (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  return sendSuccess(res, { loggedOut: true }, { message: 'Signed out.' });
});

export const me = asyncHandler(async (req, res) => sendSuccess(res, { user: req.user.toPublicJSON() }));

export const updateMe = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.userId, req.body);
  return sendSuccess(res, { user: user.toPublicJSON() }, { message: 'Profile updated.' });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.userId, req.body);
  return sendSuccess(res, { changed: true }, { message: 'Password updated.' });
});

export const searchUsers = asyncHandler(async (req, res) => {
  const users = await authService.searchUsers(req.query.q, { excludeIds: [req.userId] });
  return sendSuccess(res, { users });
});
