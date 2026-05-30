import { sql, ensureSchema, ensureAdminSchema, getMaxRooms, activeRoomCount } from '../_lib/db.js';
import { requireAdmin, AdminError } from '../_lib/admin-auth.js';
import { ok, err, cors } from '../_lib/http.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return err(res, 405, 'METHOD', 'GET only');

  try {
    await ensureSchema();
    await ensureAdminSchema();
    requireAdmin(req);

    const q = sql();
    const active = await activeRoomCount();
    const max = await getMaxRooms();
    const byStatus = await q`
      SELECT (state->>'status') AS status, count(*)::int AS n
      FROM rooms WHERE expires_at > now()
      GROUP BY (state->>'status')
    `;
    const oldest = await q`
      SELECT code, extract(epoch FROM (now() - created_at))::int AS age_sec
      FROM rooms WHERE expires_at > now()
      ORDER BY created_at ASC LIMIT 1
    `;
    const recentAudit = await q`
      SELECT action, details, ip, created_at FROM admin_audit
      ORDER BY created_at DESC LIMIT 20
    `;
    const failedRecent = await q`
      SELECT count(*)::int AS n FROM admin_failed_logins
      WHERE attempted_at > now() - interval '24 hours'
    `;
    const config = await q`SELECT key, value, updated_at FROM admin_config`;

    ok(res, {
      maxRooms: max,
      maxRoomsEnv: parseInt(process.env.MAX_ROOMS ?? '10', 10),
      activeRooms: active,
      byStatus: Object.fromEntries(byStatus.map(r => [r.status ?? 'unknown', r.n])),
      oldest: oldest[0] ?? null,
      failedLogins24h: failedRecent[0]?.n ?? 0,
      recentAudit,
      config,
      version: '0.3.0',
    });
  } catch (e) {
    if (e instanceof AdminError) return err(res, e.code === 'NO_CONFIG' ? 503 : 401, e.code, e.message);
    console.error('[admin/stats]', e);
    err(res, 500, 'INTERNAL', 'Server error');
  }
}
