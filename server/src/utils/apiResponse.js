/**
 * Every successful response uses the same envelope:
 *   { success: true, data: <payload>, meta?: <pagination etc> }
 * Every error response (see errorHandler) uses:
 *   { success: false, error: { code, message, details? } }
 */
export function sendSuccess(res, data, options = {}) {
  const { status = 200, meta, message } = options;
  const body = { success: true, data };
  if (meta) body.meta = meta;
  if (message) body.message = message;
  return res.status(status).json(body);
}

export function sendCreated(res, data, options = {}) {
  return sendSuccess(res, data, { ...options, status: 201 });
}

export default sendSuccess;
