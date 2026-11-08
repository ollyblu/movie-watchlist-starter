import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { setupApp } from './helpers.js';

const source = JSON.parse(readFileSync(new URL('../../data/movies.json', import.meta.url), 'utf8'));

test('GET /movies mengembalikan 20 film dengan bentuk yang dibaca frontend', async () => {
  const { api } = await setupApp();
  const { body } = await api.get('/api/movies').expect(200);

  assert.equal(body.length, 20);
  const expected = source[0];
  assert.deepEqual(
    { ...body[0], genres: [...body[0].genres].sort() },
    { ...expected, genres: [...expected.genres].sort() },
  );
});

test('filter genre tanpa membedakan huruf besar kecil', async () => {
  const { api } = await setupApp();
  const { body } = await api.get('/api/movies').query({ genre: 'sci-fi' }).expect(200);

  const expected = source.filter((movie) => movie.genres.includes('Sci-Fi')).map((movie) => movie.id).sort((a, b) => a - b);
  assert.deepEqual(body.map((movie) => movie.id), expected);
});

test('search mencari di judul dan sutradara', async () => {
  const { api } = await setupApp();

  const byTitle = await api.get('/api/movies').query({ search: 'inception' }).expect(200);
  assert.deepEqual(byTitle.body.map((movie) => movie.title), ['Inception']);

  const byDirector = await api.get('/api/movies').query({ search: 'nolan' }).expect(200);
  assert.equal(byDirector.body.length, source.filter((movie) => movie.director.includes('Nolan')).length);
});

test('genre dan search bisa digabung', async () => {
  const { api } = await setupApp();
  const { body } = await api.get('/api/movies').query({ genre: 'Drama', search: 'nolan' }).expect(200);
  assert.deepEqual(body.map((movie) => movie.title).sort(), ['Interstellar', 'Oppenheimer', 'The Dark Knight']);
});

test('search memperlakukan wildcard dan SQL sebagai teks biasa', async () => {
  const { api } = await setupApp();
  for (const search of ['%', '_', "' OR 1=1 --"]) {
    const { body } = await api.get('/api/movies').query({ search }).expect(200);
    assert.deepEqual(body, [], search);
  }
});

test('hasil kosong tetap 200, parameter kosong diabaikan', async () => {
  const { api } = await setupApp();
  assert.deepEqual((await api.get('/api/movies').query({ genre: 'Western' }).expect(200)).body, []);
  assert.equal((await api.get('/api/movies?search=&genre=').expect(200)).body.length, 20);
});

test('shuffle memuat film yang sama dengan urutan berbeda', async () => {
  const { api } = await setupApp();
  const orders = [];
  for (let i = 0; i < 5; i += 1) {
    const { body } = await api.get('/api/movies').query({ shuffle: 'true' }).expect(200);
    assert.deepEqual(body.map((movie) => movie.id).sort((a, b) => a - b), source.map((movie) => movie.id));
    orders.push(body.map((movie) => movie.id).join());
  }
  assert.ok(new Set(orders).size > 1);
});

test('parameter query tidak valid dibalas 400', async () => {
  const { api } = await setupApp();
  await api.get('/api/movies?shuffle=mungkin').expect(400);
  await api.get('/api/movies?genre=a&genre=b').expect(400);
});

test('GET /movies/:id: 200, 404, dan 400', async () => {
  const { api } = await setupApp();
  assert.equal((await api.get('/api/movies/14').expect(200)).body.title, 'Memento');
  await api.get('/api/movies/9999').expect(404);
  for (const id of ['abc', '0', '-1', '1.5', '1e2']) {
    await api.get(`/api/movies/${id}`).expect(400);
  }
});

test('JSON rusak dibalas 400, route tak dikenal 404', async () => {
  const { api } = await setupApp();
  await api.post('/api/auth/login').set('Content-Type', 'application/json').send('{rusak').expect(400);
  const res = await api.get('/api/tidak-ada').expect(404);
  assert.equal(typeof res.body.message, 'string');
});

test('dokumentasi dan health check tersedia', async () => {
  const { api } = await setupApp();
  await api.get('/api/health').expect(200);
  await api.get('/api/docs/').expect(200);
});
