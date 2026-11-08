import { ApiError } from '../errors.js';

/**
 * Validates parts of a request and puts the parsed values on req.valid.
 * Zod objects drop unknown keys, so the extra fields the frontend sends (movie_id, opinion, ...)
 * are ignored rather than rejected.
 */
export const validate = (schemas) => (req, _res, next) => {
  req.valid = {};
  const issues = [];

  for (const [part, schema] of Object.entries(schemas)) {
    const result = schema.safeParse(req[part] ?? {});
    if (result.success) {
      req.valid[part] = result.data;
    } else {
      issues.push(...result.error.issues.map((issue) => ({
        field: issue.path.join('.') || part,
        message: issue.message,
      })));
    }
  }

  if (issues.length > 0) throw new ApiError(400, issues[0].message, issues);
  next();
};
