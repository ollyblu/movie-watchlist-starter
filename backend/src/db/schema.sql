-- STRICT makes SQLite enforce column types, which it otherwise treats as hints.
-- Timestamps are ISO 8601 UTC so that JavaScript's Date parses them correctly.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT, -- ids are never reused, so an old JWT cannot match a new user
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS movies (
  id           INTEGER PRIMARY KEY,
  title        TEXT NOT NULL,
  year         INTEGER NOT NULL,
  director     TEXT NOT NULL,
  rating       REAL NOT NULL,
  duration     TEXT NOT NULL,
  synopsis     TEXT NOT NULL,
  poster_url   TEXT NOT NULL,
  cast_members TEXT NOT NULL -- JSON array: only ever displayed, never filtered
) STRICT;

CREATE TABLE IF NOT EXISTS genres (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
) STRICT;

CREATE TABLE IF NOT EXISTS movie_genres (
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (movie_id, genre_id)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_movie_genres_genre ON movie_genres(genre_id);

-- The composite primary key makes duplicates impossible and already serves lookups by user_id.
CREATE TABLE IF NOT EXISTS watchlists (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, movie_id)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_watchlists_movie ON watchlists(movie_id);

CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id   INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review     TEXT NOT NULL CHECK (length(review) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, movie_id)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_reviews_movie ON reviews(movie_id);
