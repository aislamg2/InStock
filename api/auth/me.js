import { sql } from '@vercel/postgres';
import { ensureSchema } from '../_lib/db.js';
import { getSession } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    await ensureSchema();
    const session = await getSession(req);
    if (!session) {
      return res.status(200).json({ user: null, organization: null });
    }
    const orgRes = await sql`
      SELECT id, name, short_name FROM organizations WHERE id = ${session.org_id} LIMIT 1
    `;
    const org = orgRes.rows[0]
      ? {
          id: orgRes.rows[0].id,
          name: orgRes.rows[0].name,
          shortName: orgRes.rows[0].short_name,
        }
      : null;
    res.status(200).json({
      user: {
        id: session.user_id,
        username: session.username,
        role: session.role,
        orgId: session.org_id,
      },
      organization: org,
    });
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
