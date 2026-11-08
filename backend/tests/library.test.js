import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUser, setupApp } from './helpers.js';

test('alur watchlist: tambah, lihat, hapus', async () => {
  const { api } = await setupApp();
  const user = await createUser(api);

  const added = await user.as('post', '/api/watchlist').send({ movieId: 3 }).expect(201);
  assert.equal(added.body.movie_id, 3);

  const list = await user.as('get', '/api/watchlist').expect(200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].movie.title, 'The Dark Knight');

  await user.as('delete', '/api/watchlist/3').expect(204);
  assert.deepEqual((await user.as('get', '/api/watchlist').expect(200)).body, []);
});

test('watchlist: duplikat 409, film tak dikenal 404, hapus yang tidak ada 404', async () => {
  const { api } = await setupApp();
  const user = await createUser(api);

  await user.as('post', '/api/watchlist').send({ movieId: 3 }).expect(201);
  await user.as('post', '/api/watchlist').send({ movieId: 3 }).expect(409);
  await user.as('post', '/api/watchlist').send({ movieId: 9999 }).expect(404);
  await user.as('delete', '/api/watchlist/4').expect(404);
});

test('watchlist menolak movieId tidak valid dan mengabaikan field tambahan dari frontend', async () => {
  const { api } = await setupApp();
  const user = await createUser(api);

  for (const movieId of ['1', 1.5, 0, -1, null, undefined]) {
    await user.as('post', '/api/watchlist').send({ movieId }).expect(400);
  }
  await user.as('post', '/api/watchlist').send({ movieId: 1, movie_id: 1 }).expect(201);
  await user.as('delete', '/api/watchlist/abc').expect(400);
});

test('watched: review pertama 201, berikutnya memperbarui baris yang sama dengan 200', async () => {
  const { api } = await setupApp();
  const user = await createUser(api);

  const first = await user.as('post', '/api/watched').send({ movieId: 1, rating: 3, review: 'Lumayan' }).expect(201);
  const second = await user.as('post', '/api/watched').send({ movieId: 1, rating: 5, review: 'Setelah nonton ulang, bagus' }).expect(200);

  assert.equal(second.body.rating, 5);
  assert.equal(second.body.created_at, first.body.created_at);

  const list = await user.as('get', '/api/watched').expect(200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].review, 'Setelah nonton ulang, bagus');
});

test('watched memisahkan rating user dari rating film', async () => {
  const { api } = await setupApp();
  const user = await createUser(api);
  await user.as('post', '/api/watched').send({ movieId: 1, rating: 2, review: 'Kurang' }).expect(201);

  const [entry] = (await user.as('get', '/api/watched').expect(200)).body;
  assert.equal(entry.rating, 2);
  assert.equal(entry.movie.rating, 8.8);
  assert.equal(entry.movie_id, 1);
});

test('watched menerima payload persis dari frontend', async () => {
  const { api } = await setupApp();
  const user = await createUser(api);
  await user.as('post', '/api/watched')
    .send({ movieId: 2, movie_id: 2, rating: 4, review: 'Bagus', opinion: 'Bagus' })
    .expect(201);
});

test('watched memvalidasi rating, review, dan film', async () => {
  const { api } = await setupApp();
  const user = await createUser(api);
  const base = { movieId: 1, rating: 5, review: 'Bagus' };

  const invalid = [
    { ...base, rating: 0 },
    { ...base, rating: 6 },
    { ...base, rating: 4.5 },
    { ...base, rating: '5' },
    { ...base, rating: undefined },
    { ...base, review: '' },
    { ...base, review: '   ' },
    { ...base, review: undefined },
    { ...base, review: 'x'.repeat(2001) },
  ];
  for (const body of invalid) {
    await user.as('post', '/api/watched').send(body).expect(400);
  }
  await user.as('post', '/api/watched').send({ ...base, movieId: 9999 }).expect(404);
});

test('data antar-user terpisah dan user_id dari body diabaikan', async () => {
  const { api } = await setupApp();
  const alice = await createUser(api);
  const bob = await createUser(api);

  await alice.as('post', '/api/watchlist').send({ movieId: 1 }).expect(201);
  await alice.as('post', '/api/watched').send({ movieId: 1, rating: 5, review: 'Punya Alice' }).expect(201);

  assert.deepEqual((await bob.as('get', '/api/watchlist').expect(200)).body, []);
  assert.deepEqual((await bob.as('get', '/api/watched').expect(200)).body, []);

  // Bob cannot remove Alice's item, and cannot write into her account by naming her id.
  await bob.as('delete', '/api/watchlist/1').expect(404);
  await bob.as('post', '/api/watched')
    .send({ movieId: 1, rating: 1, review: 'Punya Bob', user_id: alice.id, userId: alice.id })
    .expect(201);

  const aliceReviews = (await alice.as('get', '/api/watched').expect(200)).body;
  assert.equal(aliceReviews[0].review, 'Punya Alice');
  assert.equal((await alice.as('get', '/api/watchlist').expect(200)).body.length, 1);
});
