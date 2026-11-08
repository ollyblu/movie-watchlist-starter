import { GoogleGenAI } from '@google/genai';
import { ApiError } from '../errors.js';

function unavailable(message, retryable) {
  const err = new ApiError(503, message);
  err.retryable = retryable;
  return err;
}

// 429 means this key's quota is spent; 401/403 mean the key is invalid or revoked.
// Either way another key may still work, so the same request moves on to the next one.
const isKeyProblem = (err) => err.status === 429 || err.status === 401 || err.status === 403;

/**
 * The only file that knows about the Gemini SDK. Tests replace it with a fake `generate`,
 * or pass a fake `createClient` to exercise key rotation.
 *
 * With several keys, the client remembers the last key that worked, so once a key hits its
 * limit later requests start from the next one instead of failing on it again.
 */
export function createGeminiClient({
  apiKeys = [],
  model,
  timeoutMs,
  createClient = (apiKey) => new GoogleGenAI({ apiKey }),
}) {
  const clients = apiKeys.map(createClient);
  let current = 0;

  return {
    async generate({ systemInstruction, content, responseSchema }) {
      if (clients.length === 0) throw unavailable('Layanan rekomendasi belum dikonfigurasi', false);

      for (let tried = 0; tried < clients.length; tried += 1) {
        const index = (current + tried) % clients.length;
        try {
          const response = await clients[index].models.generateContent({
            model,
            contents: content,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema,
              temperature: 0.4,
              abortSignal: AbortSignal.timeout(timeoutMs),
            },
          });
          current = index;
          return response.text;
        } catch (err) {
          // Only the key's position is logged, never the key itself.
          console.error(`Gemini key #${index + 1} gagal (status ${err.status ?? err.name}): ${err.message}`);
          if (isKeyProblem(err)) continue;

          // Timeouts and Gemini's own 5xx are usually brief, so one more attempt is worthwhile.
          const retryable = err.name === 'TimeoutError' || err.name === 'AbortError' || err.status >= 500;
          throw unavailable('Layanan rekomendasi sedang tidak tersedia. Coba lagi nanti.', retryable);
        }
      }

      throw unavailable('Kuota layanan rekomendasi sedang habis. Coba lagi nanti.', false);
    },
  };
}
