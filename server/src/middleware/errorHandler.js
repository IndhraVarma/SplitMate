import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { MoneyError } from '../../../shared/money.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/** 404 for any unmatched route, so the client always gets the JSON envelope. */
export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`No API route matches ${req.method} ${req.originalUrl}`));
}

/**
 * Converts anything thrown anywhere in the stack into the standard error
 * envelope. Internal details (stack traces, driver messages, mongo keys) are
 * only ever included outside production.
 */
export function errorHandler(error, req, res, _next) {
  let apiError = error;
  if (!(apiError instanceof ApiError)) apiError = translate(error);

  if (apiError.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} ->`, error);
  }

  const body = {
    success: false,
    error: { code: apiError.code, message: apiError.message },
  };
  if (apiError.details) body.error.details = apiError.details;
  if (!config.isProduction && apiError.statusCode >= 500) body.error.stack = error.stack;

  res.status(apiError.statusCode || 500).json(body);
}

function translate(error) {
  if (error instanceof ZodError) {
    return ApiError.unprocessable('Some of the information you entered is not valid.', {
      code: 'VALIDATION_ERROR',
      details: error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  // Money / split invariant violations are the user's fault, not a server bug.
  if (error instanceof MoneyError || error.name === 'MoneyError') {
    return ApiError.unprocessable(error.message, { code: 'INVALID_AMOUNT' });
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return ApiError.unprocessable('Some of the information you entered is not valid.', {
      code: 'VALIDATION_ERROR',
      details: Object.values(error.errors).map((e) => ({ field: e.path, message: e.message })),
    });
  }

  if (error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest('That identifier is not valid.', { code: 'INVALID_ID' });
  }

  if (error instanceof mongoose.Error.VersionError) {
    return ApiError.conflict(
      'Someone else changed this item while you were editing it. Reload and try again.',
      { code: 'CONCURRENT_MODIFICATION' }
    );
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {}).join(', ');
    return ApiError.conflict(
      field ? `That ${field.replace(/^.*\./, '')} is already in use.` : 'That record already exists.',
      { code: 'DUPLICATE_KEY' }
    );
  }

  if (error.type === 'entity.parse.failed') {
    return ApiError.badRequest('The request body is not valid JSON.', { code: 'INVALID_JSON' });
  }

  if (error.message === 'NOT_ALLOWED_BY_CORS') {
    return ApiError.forbidden('This origin is not allowed to call the API.', {
      code: 'CORS_REJECTED',
    });
  }

  return ApiError.internal();
}

export default errorHandler;
