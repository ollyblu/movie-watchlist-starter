import { createDb } from './client.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';

// Only the database settings are needed here, so JWT_SECRET is not required to run the seeder.
const db = await createDb({
  url: process.env.DATABASE_URL || 'file:./data/filmlog.db',
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

await migrate(db);
const count = await seed(db);
console.log(`Database siap: ${count} film ter-seed`);
db.close();
