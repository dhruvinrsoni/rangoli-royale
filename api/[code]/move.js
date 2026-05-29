import { sql, TTL_PLAYING_MIN, TTL_ENDED_MIN } from '../_lib/db.js';
import { ok, err, readBody, withSetup } from '../_lib/http.js';
import { normalizeCode, applyServerMove, RoomError } from '../_lib/room-logic.js';

export default async function handler(req, res) {
  await withSetup(req, res, async () => {
    if (req.method !== 'POST') return err(res, 405, 'METHOD', 'POST only');
    const code = normalizeCode(req.query?.code);
    const body = await readBody(req);
    const { edgeId, clientId, expectedMoves } = body || {};
    if (!code || !clientId || !edgeId) return err(res, 400, 'BAD_REQUEST', 'code + clientId + edgeId required');

    const q = sql();
    const rows = await q`SELECT state FROM rooms WHERE code = ${code} AND expires_at > now()`;
    if (rows.length === 0) throw new RoomError('ROOM_NOT_FOUND', 'Room expired or not found');

    const current = rows[0].state;
    if (Number.isFinite(expectedMoves) && current.moveLog.length !== expectedMoves) {
      throw new RoomError('CONFLICT', 'State changed, refresh');
    }

    const next = applyServerMove(current, { clientId, edgeId });
    const ttl = next.status === 'ended' ? TTL_ENDED_MIN : TTL_PLAYING_MIN;

    const updated = await q`
      UPDATE rooms
      SET state = ${JSON.stringify(next)}::jsonb,
          expires_at = now() + (${ttl} * interval '1 minute')
      WHERE code = ${code}
        AND jsonb_array_length(state->'moveLog') = ${current.moveLog.length}
      RETURNING code
    `;
    if (updated.length === 0) throw new RoomError('CONFLICT', 'State changed during write, refresh');

    ok(res, { state: next });
  });
}
