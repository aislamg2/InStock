// Shared DB helpers + one-time schema initialization.
// Tables are created lazily on the first request that touches the DB,
// so there's no separate migration step to remember.

import { sql } from '@vercel/postgres';
import crypto from 'node:crypto';

let initPromise = null;

export function getSql() {
  return sql;
}

export async function ensureSchema() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS organizations (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      short_name  TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      username       TEXT NOT NULL UNIQUE,
      password_hash  TEXT NOT NULL,
      salt           TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'member',
      org_id         TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )`;

    await sql`CREATE TABLE IF NOT EXISTS sessions (
      token       TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL
    )`;

    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`;

    await sql`CREATE TABLE IF NOT EXISTS org_state (
      org_id      TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      state       JSONB NOT NULL DEFAULT '{}'::jsonb,
      version     INTEGER NOT NULL DEFAULT 0,
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_by  TEXT
    )`;

    // Seed the Notre Dame organization.
    await sql`INSERT INTO organizations (id, name, short_name)
              VALUES ('org_nd', 'University of Notre Dame', 'Notre Dame')
              ON CONFLICT (id) DO NOTHING`;

    // Seed a default admin if no admin exists yet.
    const admins = await sql`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
    if (admins.rows.length === 0) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = await scryptHash('admin123', salt);
      await sql`INSERT INTO users (id, username, password_hash, salt, role, org_id)
                VALUES ('user_admin', 'admin', ${hash}, ${salt}, 'admin', 'org_nd')`;
    }

    // Ensure the default org has an empty state row.
    await sql`INSERT INTO org_state (org_id, state, version)
              VALUES ('org_nd', '{}'::jsonb, 0)
              ON CONFLICT (org_id) DO NOTHING`;
  })();
  return initPromise;
}

// Local helper so this module is self-contained.
function scryptHash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) return reject(err);
      resolve(key.toString('hex'));
    });
  });
}
