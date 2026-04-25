import { sql } from '@vercel/postgres';
import { ensureSchema } from '../_lib/db.js';
import {
  makeSalt,
  hashPassword,
  makeToken,
  sessionExpiry,
  setSessionCookie,
} from '../_lib/auth.js';

const USERNAME_RE = /^[a-zA-Z0-9_.-]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    await ensureSchema();
    const { username, password, orgName } = req.body || {};

    const errors = {};
    if (!username || !username.trim()) errors.username = 'Required';
    else if (username.trim().length < 3)
      errors.username = 'Must be at least 3 characters';
    else if (!USERNAME_RE.test(username.trim()))
      errors.username = 'Letters, numbers, dot, dash, underscore only';

    if (!password) errors.password = 'Required';
    else if (password.length < 6)
      errors.password = 'Must be at least 6 characters';

    if (!orgName || !orgName.trim()) errors.orgName = 'Required';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    // Validate org.
    const orgResult = await sql`
      SELECT id FROM organizations
       WHERE LOWER(name) = LOWER(${orgName.trim()})
          OR LOWER(short_name) = LOWER(${orgName.trim()})
       LIMIT 1
    `;
    if (orgResult.rows.length === 0) {
      return res
        .status(400)
        .json({ errors: { orgName: 'Not a valid organization' } });
    }
    const orgId = orgResult.rows[0].id;

    // Check duplicate username.
    const dup = await sql`
      SELECT id FROM users
       WHERE LOWER(username) = LOWER(${username.trim()})
       LIMIT 1
    `;
    if (dup.rows.length > 0) {
      return res
        .status(400)
        .json({ errors: { username: 'Username already taken' } });
    }

    const userId = 'user_' + makeToken().slice(0, 8);
    const salt = makeSalt();
    const hash = await hashPassword(password, salt);
    await sql`
      INSERT INTO users (id, username, password_hash, salt, role, org_id)
      VALUES (${userId}, ${username.trim()}, ${hash}, ${salt}, 'member', ${orgId})
    `;

    // Auto-login.
    const token = makeToken();
    const expires = sessionExpiry();
    await sql`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (${token}, ${userId}, ${expires.toISOString()})
    `;
    setSessionCookie(res, token);

    res.status(201).json({
      user: {
        id: userId,
        username: username.trim(),
        role: 'member',
        orgId,
      },
    });
  } catch (err) {
    console.error('signup error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
