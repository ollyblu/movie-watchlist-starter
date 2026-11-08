import { MOVIE_COLUMNS, toMovie } from './movieRepository.js';

// `movie` stays nested: the frontend reads item.rating as the user's stars, so a flat object
// would let the film's 8.8 overwrite it and draw 9 stars.
const toEntry = (row) => ({
  movie_id: row.id,
  rating: row.user_rating,
  review: row.review,
  created_at: row.logged_at,
  updated_at: row.updated_at,
  movie: toMovie(row),
});

export function createReviewRepository(db) {
  const selectEntries = `
    SELECT r.rating AS user_rating, r.review, r.created_at AS logged_at, r.updated_at, ${MOVIE_COLUMNS}
    FROM reviews r JOIN movies m ON m.id = r.movie_id
    WHERE r.user_id = ?`;

  return {
    async listByUser(userId) {
      const { rows } = await db.execute({
        sql: `${selectEntries} ORDER BY r.updated_at DESC, r.id DESC`,
        args: [userId],
      });
      return rows.map(toEntry);
    },

    async find(userId, movieId) {
      const { rows } = await db.execute({
        sql: `${selectEntries} AND r.movie_id = ?`,
        args: [userId, movieId],
      });
      return rows[0] ? toEntry(rows[0]) : null;
    },

    /** Returns true if a new row was created, false if an existing review was updated. */
    async upsert(userId, movieId, { rating, review }) {
      const inserted = await db.execute({
        sql: `INSERT INTO reviews (user_id, movie_id, rating, review) VALUES (?, ?, ?, ?)
              ON CONFLICT (user_id, movie_id) DO NOTHING`,
        args: [userId, movieId, rating, review],
      });
      if (inserted.rowsAffected === 1) return true;

      await db.execute({
        sql: `UPDATE reviews
              SET rating = ?, review = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
              WHERE user_id = ? AND movie_id = ?`,
        args: [rating, review, userId, movieId],
      });
      return false;
    },

    /** Titles and ratings only. Review text is left out so it can never reach the LLM prompt. */
    async listTasteByUser(userId) {
      const { rows } = await db.execute({
        sql: `SELECT m.id, m.title, r.rating
              FROM reviews r JOIN movies m ON m.id = r.movie_id
              WHERE r.user_id = ? ORDER BY r.updated_at DESC`,
        args: [userId],
      });
      return rows.map((row) => ({ movie_id: row.id, title: row.title, rating: row.rating }));
    },
  };
}
