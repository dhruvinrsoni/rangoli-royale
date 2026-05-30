import { sql, ensureSchema, ensureAdminSchema } from '../../_lib/db.js';
import { requireAdmin, AdminError, getClientIp } from '../../_lib/admin-auth.js';
import { normalizeCode, nowMs } from '../../_lib/room-logic.js';
import { ok, err, cors } from '../../_lib/http.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    await ensureSchema();
    await ensureAdminSchema();
    requireAdmin(req);

    const code = normalizeCode(req.query?.code);
    if (!code) return err(res, 400, 'BAD_REQUEST', 'code required');

    const q = sql();
    const ip = getClientIp(req);

    if (req.method === 'DELETE') {
      const result = await q`DELETE FROM rooms WHERE code = ${code} RETURNING code`;
      if (result.length === 0) return err(res, 404, 'NOT_FOUND', 'Room not found');
      await q`
        INSERT INTO admin_audit (action, details, ip)
        VALUES ('delete_room', ${JSON.stringify({ code })}::jsonb, ${ip})
      `;
      return ok(res, { deleted: code });
    }

    if (req.method === 'POST') {
      const rows = await q`SELECT state FROM rooms WHERE code = ${code}`;
      if (rows.length === 0) return err(res, 404, 'NOT_FOUND', 'Room not found');
      const current = rows[0].state;
      if (current.status === 'ended') return ok(res, { state: current });
      const next = {
        ...current,
        status: 'ended',
        endReason: 'Ended by admin',
        endedAt: nowMs(),
      };
      await q`
        UPDATE rooms
        SET state = ${JSON.stringify(next)}::jsonb,
            expires_at = now() + interval '5 minutes'
        WHERE code = ${code}
      `;
      await q`
        INSERT INTO admin_audit (action, details, ip)
        VALUES ('force_end', ${JSON.stringify({ code })}::jsonb, ${ip})
      `;
      return ok(res, { state: next });
    }

    return err(res, 405, 'METHOD', 'DELETE or POST only');
  } catch (e) {
    if (e instanceof AdminError) return err(res, e.code === 'NO_CONFIG' ? 503 : 401, e.code, e.message);
    console.error('[admin/room/code]', e);
    err(res, 500, 'INTERNAL', 'Server error');
  }
}
