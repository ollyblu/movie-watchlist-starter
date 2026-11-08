import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const BACKEND_DIR = fileURLToPath(new URL('../../', import.meta.url));

/** A relative file: path is read from backend/, so running a script from another folder cannot create a second database. */
function resolveFileUrl(url) {
  const path = url.slice('file:'.length);
  if (path === ':memory:' || isAbsolute(path)) return { url, path };
  const absolute = resolve(BACKEND_DIR, path);
  return { url: `file:${absolute.replace(/\\/g, '/')}`, path: absolute };
}

export async function createDb({ url, authToken }) {
  if (url.startsWith('file:')) {
    const resolved = resolveFileUrl(url);
    url = resolved.url;
    if (resolved.path !== ':memory:') mkdirSync(dirname(resolved.path), { recursive: true });
  }

  const db = createClient({ url, authToken });

  // Plain SQLite leaves foreign keys off, while libSQL turns them on for every pooled connection.
  // The schema depends on them, so this checks instead of assuming, and refuses to run without.
  const { rows } = await db.execute('PRAGMA foreign_keys');
  if (Number(rows[0]?.foreign_keys) !== 1) {
    throw new Error('Foreign key database tidak aktif');
  }

  return db;
}
