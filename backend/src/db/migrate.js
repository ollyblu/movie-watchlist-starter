import { readFile } from 'node:fs/promises';

export async function migrate(db) {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await db.executeMultiple(schema);
}
