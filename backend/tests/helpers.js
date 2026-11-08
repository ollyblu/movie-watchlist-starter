import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db/client.js';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

export const TEST_CONFIG = {
  jwtSecret: 'test-secret-that-is-long-enough-for-hs256',
  jwtExpiresIn: '1h',
  bcryptCost: 4, // the production cost of 12 would make the suite very slow
  corsOrigin: '*',
  trustProxy: 0,
};

/** A fresh seeded in-memory database and app for each test, so tests cannot affect each other. */
export async function setupApp({ llm = { generate: async () => '{}' }, enableRateLimit = false } = {}) {
  const db = await createDb({ url: ':memory:' });
  await migrate(db);
  await seed(db);
  const app = createApp({ db, llm, config: TEST_CONFIG, enableRateLimit });
  return { db, app, api: request(app) };
}

let counter = 0;

/** Registers and logs in a new user, and returns a helper that sends requests as that user. */
export async function createUser(api) {
  counter += 1;
  const credentials = {
    username: `user${counter}`,
    email: `user${counter}@example.com`,
    password: 'password123',
  };
  await api.post('/api/auth/register').send(credentials).expect(201);
  const { body } = await api.post('/api/auth/login').send(credentials).expect(200);

  const as = (method, path) => api[method](path).set('Authorization', `Bearer ${body.token}`);
  return { ...credentials, id: body.user.id, token: body.token, as };
}
