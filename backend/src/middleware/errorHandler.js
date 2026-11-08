import { ApiError } from '../errors.js';

export const notFoundHandler = (req, _res, next) => {
  next(new ApiError(404, `Route ${req.method} ${req.path} tidak ditemukan`));
};

// The frontend reads `message` as a string and shows it in a toast, so every error uses this shape.
// Express identifies error handlers by their four arguments, so _next must stay in the signature.
export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message, details: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Body request bukan JSON yang valid' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Body request terlalu besar' });
  }

  console.error(err);
  return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
};
