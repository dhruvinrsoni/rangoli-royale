import { sql, ensureAdminSchema } from '../_lib/db.js';
import { cookieHeader, getClientIp, readCookie } from '../_lib/admin-auth.js';
import { ok, cors } from '../_lib/http.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    if (readCookie(req)) {
      await ensureAdminSchema();
      const ip = getClientIp(req);
      const q = sql();
      await q`INSERT INTO admin_audit (action, details, ip) VALUES ('logout', '{}'::jsonb, ${ip})`;
    }
  } catch {}
  res.setHeader('Set-Cookie', cookieHeader(null));
  ok(res, { ok: true });
}
