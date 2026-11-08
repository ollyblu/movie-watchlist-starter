import rateLimit from 'express-rate-limit';

const limiter = (windowMs, limit, message) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { message } });

// /recommend is public and every call spends Gemini quota.
export const recommendLimiter = () =>
  limiter(60_000, 10, 'Terlalu banyak permintaan rekomendasi. Coba lagi sebentar lagi.');

// Slows password guessing on top of bcrypt's own cost.
export const authLimiter = () =>
  limiter(15 * 60_000, 20, 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
