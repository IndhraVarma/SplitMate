/**
 * The only error type the API deliberately exposes to clients. Anything else
 * that reaches the error handler is treated as a bug and reported as a generic
 * 500 without internals.
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message       safe to show a user
   * @param {object} [options]
   * @param {string} [options.code]     stable machine-readable code
   * @param {Array}  [options.details]  field-level validation details
   */
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code || defaultCode(statusCode);
    this.details = options.details;
    this.isOperational = true;
    if (Error.captureStackTrace) Error.captureStackTrace(this, ApiError);
  }

  static badRequest(message, options) {
    return new ApiError(400, message, options);
  }

  static unauthorized(message = 'Authentication required.', options) {
    return new ApiError(401, message, options);
  }

  static forbidden(message = 'You do not have access to this resource.', options) {
    return new ApiError(403, message, options);
  }

  static notFound(message = 'Resource not found.', options) {
    return new ApiError(404, message, options);
  }

  static conflict(message, options) {
    return new ApiError(409, message, options);
  }

  static unprocessable(message, options) {
    return new ApiError(422, message, options);
  }

  static tooManyRequests(message = 'Too many requests. Please slow down.', options) {
    return new ApiError(429, message, options);
  }

  static internal(message = 'Something went wrong.', options) {
    return new ApiError(500, message, options);
  }
}

function defaultCode(statusCode) {
  const codes = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'RATE_LIMITED',
    500: 'INTERNAL_ERROR',
  };
  return codes[statusCode] || 'ERROR';
}

export default ApiError;
