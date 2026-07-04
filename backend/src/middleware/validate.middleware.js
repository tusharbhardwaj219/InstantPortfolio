'use strict';

/**
 * Middleware factory that validates req.body against a Zod schema.
 * On failure returns 422 with formatted errors.
 * @param {import('zod').ZodSchema} schema
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }
    req.body = result.data;
    return next();
  };
}

module.exports = { validate };
