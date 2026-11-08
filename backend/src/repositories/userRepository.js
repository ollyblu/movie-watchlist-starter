const toUser = (row) => row && {
  id: row.id,
  username: row.username,
  email: row.email,
  created_at: row.created_at,
};

export function createUserRepository(db) {
  return {
    async create({ username, email, passwordHash }) {
      const { rows } = await db.execute({
        sql: `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)
              RETURNING id, username, email, created_at`,
        args: [username, email, passwordHash],
      });
      return toUser(rows[0]);
    },

    /** The only query that returns password_hash, used solely to check a login. */
    async findCredentialsByEmail(email) {
      const { rows } = await db.execute({
        sql: 'SELECT id, username, email, created_at, password_hash FROM users WHERE email = ?',
        args: [email],
      });
      return rows[0] ? { user: toUser(rows[0]), passwordHash: rows[0].password_hash } : null;
    },

    async existsById(id) {
      const { rows } = await db.execute({ sql: 'SELECT 1 FROM users WHERE id = ?', args: [id] });
      return rows.length > 0;
    },
  };
}
