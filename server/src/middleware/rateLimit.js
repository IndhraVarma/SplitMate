import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const handler = (_req, _res, next) => {
  next(ApiError.tooManyRequests('Too many attempts. Please wait a minute and try again.'));
};

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  // Tests would otherwise trip the limiter and produce confusing failures.
  skip: () => config.isTest,
};

/** Tight limit on credential endpoints to blunt password guessing. */
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 10 });

/** Slightly looser limit on registration to blunt bulk account creation. */
export const registerLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, limit: 20 });

/** A broad backstop for the rest of the API. */
export const apiLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 600 });
