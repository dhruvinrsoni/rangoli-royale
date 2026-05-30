import { sql, ensureSchema, ensureAdminSchema } from '../_lib/db.js';
import { verifyPin, issueCookieValue, cookieHeader, getClientIp } from '../_lib/admin-auth.js';
import { ok, err, readBody, cors } from '../_lib/http.js';

const MAX_FAILS_PER_HOUR = 5;

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return err(res, 405, 'METHOD', 'POST only');

  try {
    const storedHash = process.env.ADMIN_PIN_HASH;
    const secret = process.env.ADMIN_COOKIE_SECRET;
    if (!storedHash || !secret) {
      return err(res, 503, 'NO_CONFIG', 'Admin not configured on server. Set ADMIN_PIN_HASH and ADMIN_COOKIE_SECRET.');
    }

    await ensureSchema();
    await ensureAdminSchema();

    const body = await readBody(req);
    const { pin } = body || {};
    if (!pin || typeof pin !== 'string') return err(res, 400, 'BAD_REQUEST', 'pin required');

    const ip = getClientIp(req);
    const q = sql();

    const failed = await q`
      SELECT count(*)::int AS n FROM admin_failed_logins
      WHERE ip = ${ip} AND attempted_at > now() - interval '1 hour'
    `;
    if ((failed[0]?.n ?? 0) >= MAX_FAILS_PER_HOUR) {
      return err(res, 429, 'RATE_LIMITED', 'Too many attempts. Try again in an hour.');
    }

    const valid = verifyPin(pin, storedHash);
    if (!valid) {
      await q`INSERT INTO admin_failed_logins (ip) VALUES (${ip})`;
      return err(res, 401, 'UNAUTHORIZED', 'Wrong PIN');
    }

    await q`DELETE FROM admin_failed_logins WHERE ip = ${ip}`;
    await q`
      INSERT INTO admin_audit (action, details, ip)
      VALUES ('login', ${JSON.stringify({})}::jsonb, ${ip})
    `;

    const cookieValue = issueCookieValue(secret);
    res.setHeader('Set-Cookie', cookieHeader(cookieValue));
    ok(res, { ok: true });
  } catch (e) {
    console.error('[admin/login]', e);
    err(res, 500, 'INTERNAL', 'Server error');
  }
}
