import { MOVIE_COLUMNS, toMovie } from './movieRepository.js';

const toItem = (row) => ({
  movie_id: row.id,
  added_at: row.added_at,
  movie: toMovie(row),
});

// Every query is filtered by user_id, which always comes from the verified token.
export function createWatchlistRepository(db) {
  const selectItems = `
    SELECT w.created_at AS added_at, ${MOVIE_COLUMNS}
    FROM watchlists w JOIN movies m ON m.id = w.movie_id
    WHERE w.user_id = ?`;

  return {
    async listByUser(userId) {
      const { rows } = await db.execute({
        sql: `${selectItems} ORDER BY w.created_at DESC, w.rowid DESC`,
        args: [userId],
      });
      return rows.map(toItem);
    },

    async find(userId, movieId) {
      const { rows } = await db.execute({
        sql: `${selectItems} AND w.movie_id = ?`,
        args: [userId, movieId],
      });
      return rows[0] ? toItem(rows[0]) : null;
    },

    /** Returns false if the movie was already listed. The primary key decides, so races are safe. */
    async add(userId, movieId) {
      const { rowsAffected } = await db.execute({
        sql: 'INSERT INTO watchlists (user_id, movie_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
        args: [userId, movieId],
      });
      return rowsAffected === 1;
    },

    /** Returns false if the movie was not listed. */
    async remove(userId, movieId) {
      const { rowsAffected } = await db.execute({
        sql: 'DELETE FROM watchlists WHERE user_id = ? AND movie_id = ?',
        args: [userId, movieId],
      });
      return rowsAffected === 1;
    },
  };
}
