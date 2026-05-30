import { sql, ensureSchema, ensureAdminSchema, invalidateMaxRoomsCache } from '../_lib/db.js';
import { requireAdmin, AdminError, getClientIp } from '../_lib/admin-auth.js';
import { ok, err, readBody, cors } from '../_lib/http.js';

const ALLOWED_KEYS = Object.freeze({
  maxRooms: { type: 'int', min: 1, max: 500 },
});

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  try {
    await ensureSchema();
    await ensureAdminSchema();
    requireAdmin(req);

    const q = sql();
    const ip = getClientIp(req);

    if (req.method === 'POST') {
      const body = await readBody(req);
      const { key, value } = body || {};
      const spec = ALLOWED_KEYS[key];
      if (!spec) return err(res, 400, 'BAD_KEY', `unknown config key '${key}'`);
      if (spec.type === 'int') {
        const n = parseInt(value, 10);
        if (!Number.isFinite(n) || n < spec.min || n > spec.max) {
          return err(res, 400, 'BAD_VALUE', `${key} must be int in [${spec.min}, ${spec.max}]`);
        }
        await q`
          INSERT INTO admin_config (key, value) VALUES (${key}, ${String(n)})
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
        `;
        if (key === 'maxRooms') invalidateMaxRoomsCache();
        await q`
          INSERT INTO admin_audit (action, details, ip)
          VALUES ('set_config', ${JSON.stringify({ key, value: n })}::jsonb, ${ip})
        `;
        return ok(res, { key, value: n });
      }
      return err(res, 400, 'BAD_TYPE', 'unsupported type');
    }

    if (req.method === 'DELETE') {
      const key = req.query?.key;
      if (!key) return err(res, 400, 'BAD_REQUEST', 'key required');
      await q`DELETE FROM admin_config WHERE key = ${key}`;
      if (key === 'maxRooms') invalidateMaxRoomsCache();
      await q`
        INSERT INTO admin_audit (action, details, ip)
        VALUES ('clear_config', ${JSON.stringify({ key })}::jsonb, ${ip})
      `;
      return ok(res, { cleared: key });
    }

    return err(res, 405, 'METHOD', 'POST or DELETE only');
  } catch (e) {
    if (e instanceof AdminError) return err(res, e.code === 'NO_CONFIG' ? 503 : 401, e.code, e.message);
    console.error('[admin/config]', e);
    err(res, 500, 'INTERNAL', 'Server error');
  }
}
