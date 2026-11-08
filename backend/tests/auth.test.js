import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { createUser, setupApp, TEST_CONFIG } from './helpers.js';

const valid = { username: 'budi', email: 'budi@example.com', password: 'password123' };

test('register menyimpan hash dan tidak pernah mengembalikan password', async () => {
  const { api, db } = await setupApp();
  const { body } = await api.post('/api/auth/register').send(valid).expect(201);

  assert.equal(body.user.email, valid.email);
  assert.ok(!JSON.stringify(body).includes('password'));

  const { rows } = await db.execute('SELECT password_hash FROM users');
  assert.match(rows[0].password_hash, /^\$2[aby]\$/);
});

test('register menolak input tidak valid dengan 400 dan pesan berupa teks', async () => {
  const { api } = await setupApp();
  const cases = [
    {},
    { ...valid, email: 'bukan-email' },
    { ...valid, password: 'pendek' },
    { ...valid, password: 'x'.repeat(73) },
    { ...valid, username: 'a' },
    { ...valid, username: '<img src=x>' },
    { ...valid, email: 123 },
  ];
  for (const body of cases) {
    const res = await api.post('/api/auth/register').send(body).expect(400);
    assert.equal(typeof res.body.message, 'string');
  }
});

test('email dan username ganda dibalas 409, tanpa membedakan huruf besar kecil', async () => {
  const { api } = await setupApp();
  await api.post('/api/auth/register').send(valid).expect(201);

  const email = await api.post('/api/auth/register').send({ ...valid, username: 'lain', email: 'BUDI@example.com' }).expect(409);
  assert.match(email.body.message, /Email/);

  const username = await api.post('/api/auth/register').send({ ...valid, username: 'BUDI', email: 'lain@example.com' }).expect(409);
  assert.match(username.body.message, /Username/);
});

test('login mengembalikan token dan user', async () => {
  const { api } = await setupApp();
  await api.post('/api/auth/register').send(valid).expect(201);

  const { body } = await api.post('/api/auth/login').send({ email: valid.email, password: valid.password }).expect(200);
  assert.equal(typeof body.token, 'string');
  assert.equal(body.user.username, valid.username);
  assert.equal(body.user.password_hash, undefined);
});

test('password salah dan email tak dikenal mendapat 401 dengan pesan yang sama', async () => {
  const { api } = await setupApp();
  await api.post('/api/auth/register').send(valid).expect(201);

  const wrong = await api.post('/api/auth/login').send({ email: valid.email, password: 'salah-sekali' }).expect(401);
  const unknown = await api.post('/api/auth/login').send({ email: 'tidakada@example.com', password: 'salah-sekali' }).expect(401);
  assert.equal(wrong.body.message, unknown.body.message);
});

test('route privat menolak semua token yang tidak sah', async () => {
  const { api } = await setupApp();
  const user = await createUser(api);
  const none = jwt.sign({}, '', { algorithm: 'none', subject: String(user.id) });
  const tokens = {
    'tanpa token': null,
    'token acak': 'bukan.token.asli',
    'secret lain': jwt.sign({}, 'secret-lain-yang-juga-cukup-panjang', { subject: String(user.id) }),
    'kedaluwarsa': jwt.sign({}, TEST_CONFIG.jwtSecret, { subject: String(user.id), expiresIn: -10 }),
    'algoritma none': none,
    'user tidak ada': jwt.sign({}, TEST_CONFIG.jwtSecret, { subject: '99999' }),
  };

  for (const [name, token] of Object.entries(tokens)) {
    const req = api.get('/api/watchlist');
    if (token) req.set('Authorization', `Bearer ${token}`);
    const res = await req;
    assert.equal(res.status, 401, name);
  }
});

test('semua route privat dilindungi', async () => {
  const { api } = await setupApp();
  await api.get('/api/watchlist').expect(401);
  await api.post('/api/watchlist').send({ movieId: 1 }).expect(401);
  await api.delete('/api/watchlist/1').expect(401);
  await api.get('/api/watched').expect(401);
  await api.post('/api/watched').send({ movieId: 1, rating: 5, review: 'x' }).expect(401);
});

test('rate limit login membalas 429', async () => {
  const { api } = await setupApp({ enableRateLimit: true });
  const attempt = () => api.post('/api/auth/login').send({ email: valid.email, password: 'password123' });
  for (let i = 0; i < 20; i += 1) await attempt().expect(401);
  const res = await attempt().expect(429);
  assert.equal(typeof res.body.message, 'string');
});
