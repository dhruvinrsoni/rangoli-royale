import { sql, ensureSchema, ensureAdminSchema } from '../_lib/db.js';
import { requireAdmin, AdminError, getClientIp } from '../_lib/admin-auth.js';
import { ok, err, cors } from '../_lib/http.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    await ensureSchema();
    await ensureAdminSchema();
    requireAdmin(req);

    const q = sql();

    if (req.method === 'GET') {
      const rows = await q`
        SELECT code, state, created_at, expires_at,
               extract(epoch FROM (now() - created_at))::int AS age_sec,
               extract(epoch FROM (expires_at - now()))::int AS ttl_sec
        FROM rooms
        WHERE expires_at > now()
        ORDER BY created_at DESC
      `;
      const rooms = rows.map(r => ({
        code: r.code,
        status: r.state?.status ?? 'unknown',
        playersIn: r.state?.players?.length ?? 0,
        playerCap: r.state?.setup?.playerCount ?? 0,
        moves: r.state?.moveLog?.length ?? 0,
        winMode: r.state?.setup?.winMode,
        shape: r.state?.setup?.shape,
        rows: r.state?.setup?.rows,
        cols: r.state?.setup?.cols,
        endReason: r.state?.endReason,
        hostName: r.state?.players?.find(p => p.seat === r.state?.hostSeat)?.name,
        ageSec: r.age_sec,
        ttlSec: r.ttl_sec,
      }));
      return ok(res, { rooms });
    }

    if (req.method === 'DELETE') {
      const ip = getClientIp(req);
      const deleted = await q`DELETE FROM rooms RETURNING code`;
      const codes = deleted.map(d => d.code);
      await q`
        INSERT INTO admin_audit (action, details, ip)
        VALUES ('wipe_rooms', ${JSON.stringify({ count: codes.length, codes })}::jsonb, ${ip})
      `;
      return ok(res, { deleted: codes.length });
    }

    return err(res, 405, 'METHOD', 'GET or DELETE only');
  } catch (e) {
    if (e instanceof AdminError) return err(res, e.code === 'NO_CONFIG' ? 503 : 401, e.code, e.message);
    console.error('[admin/rooms]', e);
    err(res, 500, 'INTERNAL', 'Server error');
  }
}
