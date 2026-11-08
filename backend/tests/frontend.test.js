import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setupApp } from './helpers.js';

test('frontend disajikan dari origin yang sama tanpa CSP ketat', async () => {
  const { api } = await setupApp();
  const res = await api.get('/').expect(200).expect('Content-Type', /html/);
  assert.match(res.text, /FilmLog/);
  assert.equal(res.headers['content-security-policy'], undefined);

  await api.get('/app.js').expect(200).expect('Content-Type', /javascript/);
});

test('API tetap memakai header ketat dan 404 JSON', async () => {
  const { api } = await setupApp();
  const health = await api.get('/api/health').expect(200);
  assert.ok(health.headers['content-security-policy']);

  const missing = await api.get('/api/tidak-ada').expect(404);
  assert.match(missing.body.message, /tidak ditemukan/);
});

test('CORS terbuka untuk origin lain, termasuk preflight dengan Authorization', async () => {
  const { api } = await setupApp();
  const preflight = await api.options('/api/watchlist')
    .set('Origin', 'http://localhost:5173')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'authorization,content-type')
    .expect(204);
  assert.equal(preflight.headers['access-control-allow-origin'], '*');
  assert.match(preflight.headers['access-control-allow-headers'], /authorization/i);

  const res = await api.get('/api/movies').set('Origin', 'https://contoh.dev').expect(200);
  assert.equal(res.headers['access-control-allow-origin'], '*');
  assert.equal(res.headers['cross-origin-resource-policy'], 'cross-origin');
});

test('path di luar /api yang tidak ada tetap 404', async () => {
  const { api } = await setupApp();
  await api.get('/berkas-tidak-ada.js').expect(404);
});
