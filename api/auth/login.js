import { sql } from '@vercel/postgres';
import { ensureSchema } from '../_lib/db.js';
import {
  hashPassword,
  safeEqual,
  makeToken,
  sessionExpiry,
  setSessionCookie,
} from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    await ensureSchema();
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await sql`
      SELECT id, username, password_hash, salt, role, org_id
        FROM users
       WHERE LOWER(username) = LOWER(${username.trim()})
       LIMIT 1
    `;
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const user = result.rows[0];
    const candidate = await hashPassword(password, user.salt);
    if (!safeEqual(candidate, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = makeToken();
    const expires = sessionExpiry();
    await sql`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (${token}, ${user.id}, ${expires.toISOString()})
    `;
    setSessionCookie(res, token);

    res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        orgId: user.org_id,
      },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
