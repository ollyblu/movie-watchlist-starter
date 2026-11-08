import jwt from 'jsonwebtoken';
import { ApiError } from '../errors.js';

export function createAuthMiddleware({ jwtSecret, userRepo }) {
  /** Returns the user id for a request's token, or null if the token is missing or not usable. */
  async function resolveUserId(req) {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) return null;

    let payload;
    try {
      // Pinning the algorithm blocks tokens that declare a different one, such as "none".
      payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    } catch {
      return null;
    }

    const userId = Number(payload.sub);
    return (await userRepo.existsById(userId)) ? userId : null;
  }

  return {
    requireAuth: async (req, _res, next) => {
      const userId = await resolveUserId(req);
      if (userId === null) throw new ApiError(401, 'Token tidak ada, tidak valid, atau kedaluwarsa');
      req.userId = userId;
      next();
    },

    // The frontend sends its stored token even when expired, and that must not block a public route.
    optionalAuth: async (req, _res, next) => {
      req.userId = await resolveUserId(req);
      next();
    },
  };
}
