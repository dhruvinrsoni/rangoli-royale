import { neon } from '@neondatabase/serverless';

let sqlInstance = null;
let bootstrapped = false;

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

export async function sweepExpired() {
  const q = sql();
  await q`DELETE FROM rooms WHERE expires_at < now()`;
}

export async function activeRoomCount() {
  const q = sql();
  const rows = await q`SELECT count(*)::int AS n FROM rooms WHERE expires_at > now()`;
  return rows[0]?.n ?? 0;
}

export function getMaxRooms() {
  const raw = process.env.MAX_ROOMS;
  const n = parseInt(raw ?? '10', 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export const TTL_LOBBY_MIN = 30;
export const TTL_PLAYING_MIN = 30;
export const TTL_ENDED_MIN = 5;
