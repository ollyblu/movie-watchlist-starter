import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/client.js';
import { migrate } from './db/migrate.js';
import { createGeminiClient } from './llm/gemini.js';

const config = loadConfig();
const db = await createDb({ url: config.databaseUrl, authToken: config.databaseAuthToken });
await migrate(db);

if (config.gemini.apiKeys.length === 0) {
  console.warn('GEMINI_API_KEY kosong: POST /api/movies/recommend akan membalas 503');
} else {
  console.log(`Gemini: ${config.gemini.apiKeys.length} API key terpasang, bergantian saat kena limit`);
}

const app = createApp({ db, config, llm: createGeminiClient(config.gemini) });

app.listen(config.port, () => {
  console.log(`FilmLog API berjalan di http://localhost:${config.port}/api`);
  console.log(`Dokumentasi: http://localhost:${config.port}/api/docs`);
});
