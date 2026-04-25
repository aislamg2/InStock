import { sql } from '@vercel/postgres';
import { ensureSchema } from '../_lib/db.js';
import { getSession, clearSessionCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    await ensureSchema();
    const session = await getSession(req);
    if (session) {
      await sql`DELETE FROM sessions WHERE token = ${session.token}`;
    }
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('logout error:', err);
    // Always clear the cookie even on error.
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  }
}
