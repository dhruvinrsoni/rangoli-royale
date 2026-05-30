import { sql, ensureSchema, ensureAdminSchema, getMaxRooms, activeRoomCount, invalidateMaxRoomsCache } from '../_lib/db.js';
import {
  verifyPin, issueCookieValue, cookieHeader, getClientIp,
  requireAdmin, AdminError, readCookie,
} from '../_lib/admin-auth.js';
import { ok, err, readBody, cors } from '../_lib/http.js';
import { normalizeCode, nowMs } from '../_lib/room-logic.js';

const MAX_FAILS_PER_HOUR = 5;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function pinMode() {
  const raw = (process.env.ADMIN_PIN_MODE || '').toLowerCase().trim();
  if (raw === 'day' || raw === 'daily' || raw === '1') return 'day';
  if (raw === 'hour' || raw === 'hourly') return 'hour';
  return 'static';
}

function suffixLength() {
  return { static: 0, day: 2, hour: 4 }[pinMode()];
}

function istDate(offsetMs = 0) {
  return new Date(Date.now() + IST_OFFSET_MS + offsetMs);
}

function dayPart(d) { return String(d.getUTCDate()).padStart(2, '0'); }
function hourPart(d) { return String(d.getUTCHours()).padStart(2, '0'); }

function validSuffixes() {
  const mode = pinMode();
  if (mode === 'static') return [''];
  if (mode === 'day') return [dayPart(istDate())];
  if (mode === 'hour') {
    const now = istDate();
    const prev = istDate(-60 * 60 * 1000);
    return [dayPart(now) + hourPart(now), dayPart(prev) + hourPart(prev)];
  }
  return [''];
}

function stripDailySuffix(submitted) {
  const mode = pinMode();
  if (mode === 'static') return { ok: true, pin: submitted };
  const len = suffixLength();
  if (typeof submitted !== 'string' || submitted.length <= len) return { ok: false };
  const suffix = submitted.slice(-len);
  const corePin = submitted.slice(0, -len);
  const valid = validSuffixes();
  if (!valid.includes(suffix)) return { ok: false };
  return { ok: true, pin: corePin };
}

function secretPrefix() {
  return process.env.BIJA || '';
}

function modeLabel() {
  const m = pinMode();
  if (m === 'day') return 'daily';
  if (m === 'hour') return 'hourly';
  return null;
}

async function dispatch(req, res, path) {
  if (path === 'login' && req.method === 'POST') return handleLogin(req, res);
  if (path === 'logout' && req.method === 'POST') return handleLogout(req, res);
  if (path === 'me' && req.method === 'GET') return handleMe(req, res);

  await ensureSchema();
  await ensureAdminSchema();
  requireAdmin(req);

  if (path === 'rooms') {
    if (req.method === 'GET') return listRooms(req, res);
    if (req.method === 'DELETE') return wipeRooms(req, res);
  }
  if (path === 'stats' && req.method === 'GET') return getStats(req, res);
  if (path === 'config') {
    if (req.method === 'POST') return setConfig(req, res);
    if (req.method === 'DELETE') return clearConfig(req, res);
  }

  const roomMatch = path.match(/^room\/(.+)$/);
  if (roomMatch) {
    const code = normalizeCode(roomMatch[1]);
    if (!code) return err(res, 400, 'BAD_REQUEST', 'code required');
    if (req.method === 'DELETE') return deleteRoom(req, res, code);
    if (req.method === 'POST') return forceEndRoom(req, res, code);
  }

  return err(res, 404, 'NOT_FOUND', `unknown admin path: ${path}`);
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const raw = req.query?.path;
  const path = Array.isArray(raw) ? raw.join('/') : (raw || '');

  try {
    return await dispatch(req, res, path);
  } catch (e) {
    if (e instanceof AdminError) return err(res, e.code === 'NO_CONFIG' ? 503 : 401, e.code, e.message);
    console.error('[admin]', path, e);
    err(res, 500, 'INTERNAL', 'Server error');
  }
}

async function handleLogin(req, res) {
  const storedHash = process.env.ADMIN_PIN_HASH;
  const secret = process.env.ADMIN_COOKIE_SECRET;
  if (!storedHash || !secret) {
    return err(res, 503, 'NO_CONFIG', 'Admin not configured. Set ADMIN_PIN_HASH and ADMIN_COOKIE_SECRET.');
  }

  await ensureSchema();
  await ensureAdminSchema();

  const body = await readBody(req);
  const { pin: rawPin } = body || {};
  if (!rawPin || typeof rawPin !== 'string') return err(res, 400, 'BAD_REQUEST', 'pin required');

  const ip = getClientIp(req);
  const q = sql();

  const failed = await q`
    SELECT count(*)::int AS n FROM admin_failed_logins
    WHERE ip = ${ip} AND attempted_at > now() - interval '1 hour'
  `;
  if ((failed[0]?.n ?? 0) >= MAX_FAILS_PER_HOUR) {
    return err(res, 429, 'RATE_LIMITED', 'Too many attempts. Try again in an hour.');
  }

  const stripped = stripDailySuffix(rawPin);
  if (!stripped.ok) {
    await q`INSERT INTO admin_failed_logins (ip) VALUES (${ip})`;
    return err(res, 401, 'UNAUTHORIZED', 'Wrong PIN');
  }

  const valid = verifyPin(stripped.pin, storedHash, secretPrefix());
  if (!valid) {
    await q`INSERT INTO admin_failed_logins (ip) VALUES (${ip})`;
    return err(res, 401, 'UNAUTHORIZED', 'Wrong PIN');
  }

  await q`DELETE FROM admin_failed_logins WHERE ip = ${ip}`;
  await q`INSERT INTO admin_audit (action, details, ip) VALUES ('login', '{}'::jsonb, ${ip})`;

  const cookieValue = issueCookieValue(secret);
  res.setHeader('Set-Cookie', cookieHeader(cookieValue));
  ok(res, { ok: true, mode: modeLabel(), hasPrefix: !!secretPrefix() });
}

async function handleLogout(req, res) {
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

async function handleMe(req, res) {
  try {
    const session = requireAdmin(req);
    ok(res, { ok: true, expiresAt: session.expiry * 1000, mode: modeLabel(), hasPrefix: !!secretPrefix() });
  } catch (e) {
    if (e instanceof AdminError) return err(res, e.code === 'NO_CONFIG' ? 503 : 401, e.code, e.message);
    throw e;
  }
}

async function listRooms(req, res) {
  const q = sql();
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
  ok(res, { rooms });
}

async function wipeRooms(req, res) {
  const q = sql();
  const ip = getClientIp(req);
  const deleted = await q`DELETE FROM rooms RETURNING code`;
  const codes = deleted.map(d => d.code);
  await q`
    INSERT INTO admin_audit (action, details, ip)
    VALUES ('wipe_rooms', ${JSON.stringify({ count: codes.length, codes })}::jsonb, ${ip})
  `;
  ok(res, { deleted: codes.length });
}

async function getStats(req, res) {
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
    mode: modeLabel(),
    hasPrefix: !!secretPrefix(),
    version: '0.3.2',
  });
}

const ALLOWED_CONFIG_KEYS = Object.freeze({
  maxRooms: { type: 'int', min: 1, max: 500 },
});

async function setConfig(req, res) {
  const q = sql();
  const ip = getClientIp(req);
  const body = await readBody(req);
  const { key, value } = body || {};
  const spec = ALLOWED_CONFIG_KEYS[key];
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

async function clearConfig(req, res) {
  const q = sql();
  const ip = getClientIp(req);
  const key = req.query?.key;
  if (!key) return err(res, 400, 'BAD_REQUEST', 'key required');
  await q`DELETE FROM admin_config WHERE key = ${key}`;
  if (key === 'maxRooms') invalidateMaxRoomsCache();
  await q`
    INSERT INTO admin_audit (action, details, ip)
    VALUES ('clear_config', ${JSON.stringify({ key })}::jsonb, ${ip})
  `;
  ok(res, { cleared: key });
}

async function deleteRoom(req, res, code) {
  const q = sql();
  const ip = getClientIp(req);
  const result = await q`DELETE FROM rooms WHERE code = ${code} RETURNING code`;
  if (result.length === 0) return err(res, 404, 'NOT_FOUND', 'Room not found');
  await q`
    INSERT INTO admin_audit (action, details, ip)
    VALUES ('delete_room', ${JSON.stringify({ code })}::jsonb, ${ip})
  `;
  ok(res, { deleted: code });
}

async function forceEndRoom(req, res, code) {
  const q = sql();
  const ip = getClientIp(req);
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
  ok(res, { state: next });
}
