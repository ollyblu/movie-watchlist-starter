const MIN_SECRET_LENGTH = 32;

/** "a, b,,c" becomes ["a", "b", "c"]. Used for values that may hold several entries. */
export const parseList = (value) => (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);

/** "*" or empty allows every origin; otherwise a comma-separated allowlist. */
function parseCorsOrigin(value) {
  const origins = parseList(value);
  if (origins.length === 0 || origins.includes('*')) return '*';
  return origins.length === 1 ? origins[0] : origins;
}

/** Reads and checks env once, so a bad deployment fails at boot, not on the first login. */
export function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET wajib diisi, minimal ${MIN_SECRET_LENGTH} karakter`);
  }

  return {
    port: Number(env.PORT) || 8000,
    databaseUrl: env.DATABASE_URL || 'file:./data/filmlog.db',
    databaseAuthToken: env.DATABASE_AUTH_TOKEN || undefined,
    jwtSecret,
    jwtExpiresIn: '7d',
    bcryptCost: 12,
    corsOrigin: parseCorsOrigin(env.CORS_ORIGIN),
    trustProxy: Number(env.TRUST_PROXY) || 0,
    gemini: {
      apiKeys: parseList(env.GEMINI_API_KEY),
      model: env.GEMINI_MODEL || 'gemini-3.6-flash',
      timeoutMs: 15_000,
    },
  };
}
