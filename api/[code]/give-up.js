import { sql, TTL_ENDED_MIN } from '../_lib/db.js';
import { ok, err, readBody, withSetup } from '../_lib/http.js';
import { normalizeCode, RoomError, nowMs } from '../_lib/room-logic.js';

export default async function handler(req, res) {
  await withSetup(req, res, async () => {
    if (req.method !== 'POST') return err(res, 405, 'METHOD', 'POST only');
    const code = normalizeCode(req.query?.code);
    const body = await readBody(req);
    const { clientId } = body || {};
    if (!code || !clientId) return err(res, 400, 'BAD_REQUEST', 'code + clientId required');

    const q = sql();
    const rows = await q`SELECT state FROM rooms WHERE code = ${code} AND expires_at > now()`;
    if (rows.length === 0) throw new RoomError('ROOM_NOT_FOUND', 'Room expired or not found');

    const current = rows[0].state;
    if (current.status !== 'in-progress') throw new RoomError('BAD_STATE', 'Game not running');

    const player = current.players.find(p => p.clientId === clientId);
    if (!player) throw new RoomError('NOT_IN_ROOM', 'You are not in this room');

    const next = {
      ...current,
      status: 'ended',
      endReason: `${player.name} gave up`,
      endedAt: nowMs(),
    };

    await q`
      UPDATE rooms
      SET state = ${JSON.stringify(next)}::jsonb,
          expires_at = now() + (${TTL_ENDED_MIN} * interval '1 minute')
      WHERE code = ${code}
    `;
    ok(res, { state: next });
  });
}
