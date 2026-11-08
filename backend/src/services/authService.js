import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ApiError, isUniqueViolation } from '../errors.js';

export function createAuthService({ userRepo, jwtSecret, jwtExpiresIn, bcryptCost }) {
  // Compared when the email is unknown, so that case takes as long as a wrong password.
  const dummyHash = bcrypt.hash('filmlog-timing-guard', bcryptCost);

  return {
    async register({ username, email, password }) {
      const passwordHash = await bcrypt.hash(password, bcryptCost);
      try {
        return await userRepo.create({ username, email, passwordHash });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Relying on the constraint, not a prior SELECT, keeps simultaneous sign-ups safe.
        const field = err.message.includes('users.email') ? 'Email' : 'Username';
        throw new ApiError(409, `${field} sudah terdaftar`);
      }
    },

    async login({ email, password }) {
      const found = await userRepo.findCredentialsByEmail(email);
      const matches = await bcrypt.compare(password, found?.passwordHash ?? (await dummyHash));
      if (!found || !matches) throw new ApiError(401, 'Email atau password salah');

      const token = jwt.sign({}, jwtSecret, {
        algorithm: 'HS256',
        subject: String(found.user.id),
        expiresIn: jwtExpiresIn,
      });
      return { token, user: found.user };
    },
  };
}
