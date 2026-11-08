import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../src/config.js';
import { createGeminiClient } from '../src/llm/gemini.js';

const httpError = (status) => Object.assign(new Error(`status ${status}`), { status });

/** Each key gets a fake client whose behavior comes from `plan[key]`: a status to fail with, or 'ok'. */
function fakeKeys(plan) {
  const calls = [];
  const createClient = (apiKey) => ({
    models: {
      generateContent: async () => {
        calls.push(apiKey);
        const outcome = plan[apiKey];
        if (outcome === 'ok') return { text: `{"from":"${apiKey}"}` };
        throw httpError(outcome);
      },
    },
  });
  return { calls, createClient };
}

const request = { systemInstruction: 's', content: 'c', responseSchema: {} };
const options = { model: 'test-model', timeoutMs: 1000 };

test('GEMINI_API_KEY dipisah koma menjadi beberapa key', () => {
  const config = loadConfig({ JWT_SECRET: 'x'.repeat(32), GEMINI_API_KEY: ' k1, k2 ,,k3 ' });
  assert.deepEqual(config.gemini.apiKeys, ['k1', 'k2', 'k3']);
  assert.deepEqual(loadConfig({ JWT_SECRET: 'x'.repeat(32) }).gemini.apiKeys, []);
});

test('key yang kena limit dilewati dalam request yang sama, dan key yang berhasil dipakai lagi', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { calls, createClient } = fakeKeys({ k1: 429, k2: 'ok', k3: 'ok' });
  const llm = createGeminiClient({ ...options, apiKeys: ['k1', 'k2', 'k3'], createClient });

  assert.equal(await llm.generate(request), '{"from":"k2"}');
  assert.equal(await llm.generate(request), '{"from":"k2"}');
  assert.deepEqual(calls, ['k1', 'k2', 'k2']);
});

test('key tidak valid (401/403) juga dilewati', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { createClient } = fakeKeys({ k1: 403, k2: 401, k3: 'ok' });
  const llm = createGeminiClient({ ...options, apiKeys: ['k1', 'k2', 'k3'], createClient });
  assert.equal(await llm.generate(request), '{"from":"k3"}');
});

test('semua key habis dibalas 503 tanpa retry', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { calls, createClient } = fakeKeys({ k1: 429, k2: 429 });
  const llm = createGeminiClient({ ...options, apiKeys: ['k1', 'k2'], createClient });

  await assert.rejects(llm.generate(request), (err) => {
    assert.equal(err.status, 503);
    assert.equal(err.retryable, false);
    assert.match(err.message, /Kuota/);
    return true;
  });
  assert.deepEqual(calls, ['k1', 'k2']);
});

test('error server Gemini tidak memutar key dan boleh dicoba ulang', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { calls, createClient } = fakeKeys({ k1: 500, k2: 'ok' });
  const llm = createGeminiClient({ ...options, apiKeys: ['k1', 'k2'], createClient });

  await assert.rejects(llm.generate(request), (err) => err.status === 503 && err.retryable === true);
  assert.deepEqual(calls, ['k1']);
});

test('tanpa key dibalas 503', async () => {
  const llm = createGeminiClient({ ...options, apiKeys: [] });
  await assert.rejects(llm.generate(request), (err) => err.status === 503 && err.retryable === false);
});
