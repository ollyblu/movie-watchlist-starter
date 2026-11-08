import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seed } from '../src/db/seed.js';
import { createUser, setupApp } from './helpers.js';

test('seeder memuat 20 film dan aman dijalankan ulang', async () => {
  const { db } = await setupApp();
  await seed(db);

  const count = async (table) => (await db.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n;
  assert.equal(await count('movies'), 20);
  const links = await count('movie_genres');
  await seed(db);
  assert.equal(await count('movie_genres'), links);
});

test('foreign key benar-benar ditegakkan', async () => {
  const { db, api } = await setupApp();
  const user = await createUser(api);

  await assert.rejects(
    db.execute({ sql: 'INSERT INTO watchlists (user_id, movie_id) VALUES (?, 9999)', args: [user.id] }),
    /FOREIGN KEY/,
  );
});

test('foreign key aktif di semua koneksi saat request berjalan paralel', async () => {
  const { db } = await setupApp();
  const results = await Promise.all(Array.from({ length: 8 }, () => db.execute('PRAGMA foreign_keys')));
  for (const { rows } of results) assert.equal(rows[0].foreign_keys, 1);
});

test('database menolak rating di luar 1 sampai 5', async () => {
  const { db, api } = await setupApp();
  const user = await createUser(api);

  await assert.rejects(
    db.execute({ sql: "INSERT INTO reviews (user_id, movie_id, rating, review) VALUES (?, 1, 6, 'x')", args: [user.id] }),
    /CHECK/,
  );
});

test('menghapus user ikut menghapus datanya', async () => {
  const { db, api } = await setupApp();
  const user = await createUser(api);
  await user.as('post', '/api/watchlist').send({ movieId: 1 }).expect(201);
  await user.as('post', '/api/watched').send({ movieId: 1, rating: 5, review: 'Bagus' }).expect(201);

  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [user.id] });

  for (const table of ['watchlists', 'reviews']) {
    const { rows } = await db.execute({ sql: `SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`, args: [user.id] });
    assert.equal(rows[0].n, 0, table);
  }
});
