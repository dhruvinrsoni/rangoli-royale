import { neon } from '@neondatabase/serverless';

let sqlInstance = null;
let bootstrapped = false;
let adminBootstrapped = false;
let cachedMaxRooms = null;
let cachedMaxRoomsAt = 0;
const MAX_ROOMS_CACHE_MS = 30000;

export function sql() {
  if (!sqlInstance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL not set');
    sqlInstance = neon(url);
  }
  return sqlInstance;
}

export async function ensureSchema() {
  if (bootstrapped) return;
  const q = sql();
  await q`
    CREATE TABLE IF NOT EXISTS rooms (
      code text PRIMARY KEY,
      state jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    )
  `;
  await q`CREATE INDEX IF NOT EXISTS rooms_expires_idx ON rooms(expires_at)`;
  bootstrapped = true;
}

export async function ensureAdminSchema() {
  if (adminBootstrapped) return;
  const q = sql();
  await q`
    CREATE TABLE IF NOT EXISTS admin_failed_logins (
      id bigserial PRIMARY KEY,
      ip text NOT NULL,
      attempted_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await q`CREATE INDEX IF NOT EXISTS afl_ip_idx ON admin_failed_logins(ip, attempted_at)`;
  await q`
    CREATE TABLE IF NOT EXISTS admin_audit (
      id bigserial PRIMARY KEY,
      action text NOT NULL,
      details jsonb,
      ip text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await q`CREATE INDEX IF NOT EXISTS aa_created_idx ON admin_audit(created_at DESC)`;
  await q`
    CREATE TABLE IF NOT EXISTS admin_config (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  adminBootstrapped = true;
}

export async function sweepExpired() {
  const q = sql();
  await q`DELETE FROM rooms WHERE expires_at < now()`;
}

export async function activeRoomCount() {
  const q = sql();
  const rows = await q`SELECT count(*)::int AS n FROM rooms WHERE expires_at > now()`;
  return rows[0]?.n ?? 0;
}

function envMaxRooms() {
  const raw = process.env.MAX_ROOMS;
  const n = parseInt(raw ?? '10', 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export async function getMaxRooms() {
  const now = Date.now();
  if (cachedMaxRooms !== null && now - cachedMaxRoomsAt < MAX_ROOMS_CACHE_MS) {
    return cachedMaxRooms;
  }
  let value = envMaxRooms();
  try {
    const q = sql();
    const rows = await q`SELECT value FROM admin_config WHERE key = 'maxRooms'`;
    if (rows.length > 0) {
      const dbVal = parseInt(rows[0].value, 10);
      if (Number.isFinite(dbVal) && dbVal > 0) value = dbVal;
    }
  } catch {}
  cachedMaxRooms = value;
  cachedMaxRoomsAt = now;
  return value;
}

export function invalidateMaxRoomsCache() {
  cachedMaxRooms = null;
  cachedMaxRoomsAt = 0;
}

export const TTL_LOBBY_MIN = 30;
export const TTL_PLAYING_MIN = 30;
export const TTL_ENDED_MIN = 5;
