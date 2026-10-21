import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';

/**
 * Validates and REPLACES req.body / req.query / req.params with the parsed
 * result, so controllers only ever see coerced, trusted values. Unknown keys
 * are stripped by the schemas, which blocks mass-assignment through the body.
 */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.params) req.params = schemas.params.parse(req.params ?? {});
      if (schemas.query) {
        req.validatedQuery = schemas.query.parse(req.query ?? {});
        req.query = req.validatedQuery;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          ApiError.unprocessable('Some of the information you entered is not valid.', {
            code: 'VALIDATION_ERROR',
            details: error.issues.map((issue) => ({
              field: issue.path.join('.') || '(root)',
              message: issue.message,
            })),
          })
        );
        return;
      }
      next(error);
    }
  };
}

export default validate;
