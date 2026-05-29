import { sql } from './_lib/db.js';
import { ok, err, withSetup } from './_lib/http.js';
import { normalizeCode, RoomError } from './_lib/room-logic.js';

export default async function handler(req, res) {
  await withSetup(req, res, async () => {
    if (req.method !== 'GET') return err(res, 405, 'METHOD', 'GET only');
    const code = normalizeCode(req.query?.code);
    if (!code) return err(res, 400, 'BAD_REQUEST', 'code required');

    const q = sql();
    const rows = await q`SELECT state FROM rooms WHERE code = ${code} AND expires_at > now()`;
    if (rows.length === 0) throw new RoomError('ROOM_NOT_FOUND', 'Room expired or not found');

    ok(res, { state: rows[0].state });
  });
}
