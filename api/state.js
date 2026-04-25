// Per-organization state blob.
// GET  /api/state           → { state, version, updatedAt, updatedBy }
// PUT  /api/state           → { state, version: <expectedVersion> }
//
// PUT uses optimistic concurrency: if the version on the client doesn't
// match the version in the DB, we return 409 so the client can refetch
// and merge instead of clobbering someone else's update.

import { sql } from '@vercel/postgres';
import { ensureSchema } from './_lib/db.js';
import { requireSession } from './_lib/auth.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const session = await requireSession(req, res);
    if (!session) return; // requireSession already wrote 401

    if (req.method === 'GET') {
      // Ensure a row exists for this org.
      await sql`
        INSERT INTO org_state (org_id, state, version)
        VALUES (${session.org_id}, '{}'::jsonb, 0)
        ON CONFLICT (org_id) DO NOTHING
      `;
      const result = await sql`
        SELECT state, version, updated_at, updated_by
          FROM org_state
         WHERE org_id = ${session.org_id}
         LIMIT 1
      `;
      const row = result.rows[0];
      return res.status(200).json({
        state: row.state || {},
        version: row.version,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      });
    }

    if (req.method === 'PUT') {
      const { state, version: expectedVersion } = req.body || {};
      if (state === undefined || state === null || typeof state !== 'object') {
        return res.status(400).json({ error: 'state must be an object' });
      }

      // Make sure the row exists.
      await sql`
        INSERT INTO org_state (org_id, state, version)
        VALUES (${session.org_id}, '{}'::jsonb, 0)
        ON CONFLICT (org_id) DO NOTHING
      `;

      const current = await sql`
        SELECT version FROM org_state WHERE org_id = ${session.org_id} LIMIT 1
      `;
      const dbVersion = current.rows[0]?.version ?? 0;
      if (
        typeof expectedVersion === 'number' &&
        expectedVersion !== dbVersion
      ) {
        // Version mismatch — tell the client to refetch.
        const fresh = await sql`
          SELECT state, version, updated_at, updated_by
            FROM org_state
           WHERE org_id = ${session.org_id}
           LIMIT 1
        `;
        const row = fresh.rows[0];
        return res.status(409).json({
          error: 'Version conflict',
          current: {
            state: row.state || {},
            version: row.version,
            updatedAt: row.updated_at,
            updatedBy: row.updated_by,
          },
        });
      }

      const newVersion = dbVersion + 1;
      const json = JSON.stringify(state);
      await sql`
        UPDATE org_state
           SET state      = ${json}::jsonb,
               version    = ${newVersion},
               updated_at = NOW(),
               updated_by = ${session.username}
         WHERE org_id = ${session.org_id}
      `;
      return res.status(200).json({
        ok: true,
        version: newVersion,
        updatedAt: new Date().toISOString(),
        updatedBy: session.username,
      });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('state error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
