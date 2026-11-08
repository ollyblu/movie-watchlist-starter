import { z } from 'zod';

const required = (label) => ({ error: (issue) => (issue.input === undefined ? `${label} wajib diisi` : `${label} tidak valid`) });

/** A path id such as "12". Stricter than Number(), which would also accept "1e2" or "0x10". */
export const movieIdParam = z.object({
  id: z.string().regex(/^[1-9]\d{0,9}$/, 'ID film tidak valid').transform(Number),
});

export const movieIdBody = z.int(required('movieId')).positive('movieId tidak valid');

// bcrypt only reads the first 72 bytes, so a longer password would be silently cut.
const password = z.string(required('Password'))
  .refine((value) => Buffer.byteLength(value) <= 72, 'Password maksimal 72 byte');

const email = z.string(required('Email'))
  .trim()
  .toLowerCase()
  .pipe(z.email('Format email tidak valid').max(254, 'Email terlalu panjang'));

export const registerBody = z.object({
  // The character limit also keeps markup out, since the frontend renders usernames with innerHTML.
  username: z.string(required('Username'))
    .trim()
    .min(2, 'Username minimal 2 karakter')
    .max(30, 'Username maksimal 30 karakter')
    .regex(/^[\p{L}\p{N}._+-]+$/u, 'Username hanya boleh berisi huruf, angka, dan . _ + -'),
  email,
  password: password.min(8, 'Password minimal 8 karakter'),
});

export const loginBody = z.object({
  email,
  password: password.min(1, 'Password wajib diisi'),
});

export const movieListQuery = z.object({
  genre: z.string('Parameter genre tidak valid').trim().max(50, 'Parameter genre terlalu panjang').optional(),
  search: z.string('Parameter search tidak valid').trim().max(100, 'Parameter search terlalu panjang').optional(),
  shuffle: z.enum(['true', 'false'], 'Parameter shuffle harus true atau false')
    .transform((value) => value === 'true')
    .optional(),
});

export const watchlistBody = z.object({ movieId: movieIdBody });

export const watchedBody = z.object({
  movieId: movieIdBody,
  rating: z.int(required('Rating'))
    .min(1, 'Rating harus antara 1 sampai 5')
    .max(5, 'Rating harus antara 1 sampai 5'),
  review: z.string(required('Review'))
    .trim()
    .min(1, 'Review wajib diisi')
    .max(2000, 'Review maksimal 2000 karakter'),
});

export const recommendBody = z.object({
  prompt: z.string(required('Prompt'))
    .trim()
    .min(1, 'Prompt wajib diisi')
    .max(500, 'Prompt maksimal 500 karakter'),
});
