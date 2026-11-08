import { readFile } from 'node:fs/promises';

const MOVIES_PATH = new URL('../../../data/movies.json', import.meta.url);

/** Safe to run repeatedly: rows are upserted and existing user data is never touched. */
export async function seed(db) {
  const movies = JSON.parse(await readFile(MOVIES_PATH, 'utf8'));
  const statements = [];

  for (const movie of movies) {
    statements.push({
      sql: `INSERT INTO movies (id, title, year, director, rating, duration, synopsis, poster_url, cast_members)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
              title = excluded.title, year = excluded.year, director = excluded.director,
              rating = excluded.rating, duration = excluded.duration, synopsis = excluded.synopsis,
              poster_url = excluded.poster_url, cast_members = excluded.cast_members`,
      args: [
        movie.id, movie.title, movie.year, movie.director, movie.rating,
        movie.duration, movie.synopsis, movie.poster_url, JSON.stringify(movie.cast),
      ],
    });

    for (const genre of movie.genres) {
      statements.push({ sql: 'INSERT OR IGNORE INTO genres (name) VALUES (?)', args: [genre] });
      statements.push({
        sql: `INSERT OR IGNORE INTO movie_genres (movie_id, genre_id)
              VALUES (?, (SELECT id FROM genres WHERE name = ?))`,
        args: [movie.id, genre],
      });
    }
  }

  await db.batch(statements, 'write');
  return movies.length;
}
