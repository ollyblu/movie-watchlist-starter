/** Columns for one movie, using alias `m`. Shared with the watchlist and review joins. */
export const MOVIE_COLUMNS = `
  m.id, m.title, m.year, m.director, m.rating AS movie_rating, m.duration, m.synopsis,
  m.poster_url, m.cast_members,
  (SELECT json_group_array(name) FROM (
     SELECT g.name FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id
     WHERE mg.movie_id = m.id ORDER BY g.name
   )) AS genre_names`;

export const toMovie = (row) => ({
  id: row.id,
  title: row.title,
  year: row.year,
  director: row.director,
  genres: JSON.parse(row.genre_names),
  rating: row.movie_rating,
  duration: row.duration,
  synopsis: row.synopsis,
  poster_url: row.poster_url,
  cast: JSON.parse(row.cast_members),
});

// Without this, a search for "%" would match every movie.
const escapeLike = (text) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

export function createMovieRepository(db) {
  return {
    async list({ genre, search, shuffle } = {}) {
      const conditions = [];
      const args = [];

      if (genre) {
        conditions.push(`EXISTS (
          SELECT 1 FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id
          WHERE mg.movie_id = m.id AND g.name = ?)`);
        args.push(genre);
      }
      if (search) {
        const pattern = `%${escapeLike(search)}%`;
        conditions.push(`(m.title LIKE ? ESCAPE '\\' OR m.director LIKE ? ESCAPE '\\')`);
        args.push(pattern, pattern);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await db.execute({
        sql: `SELECT ${MOVIE_COLUMNS} FROM movies m ${where} ORDER BY ${shuffle ? 'RANDOM()' : 'm.id'}`,
        args,
      });
      return rows.map(toMovie);
    },

    async findById(id) {
      const { rows } = await db.execute({
        sql: `SELECT ${MOVIE_COLUMNS} FROM movies m WHERE m.id = ?`,
        args: [id],
      });
      return rows[0] ? toMovie(rows[0]) : null;
    },
  };
}
