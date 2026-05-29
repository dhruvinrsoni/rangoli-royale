import { sql, TTL_LOBBY_MIN } from '../_lib/db.js';
import { ok, err, readBody, withSetup } from '../_lib/http.js';
import { normalizeCode, leaveRoom } from '../_lib/room-logic.js';

export default async function handler(req, res) {
  await withSetup(req, res, async () => {
    if (req.method !== 'POST') return err(res, 405, 'METHOD', 'POST only');
    const code = normalizeCode(req.query?.code);
    const body = await readBody(req);
    const { clientId } = body || {};
    if (!code || !clientId) return err(res, 400, 'BAD_REQUEST', 'code + clientId required');

    const q = sql();
    const rows = await q`SELECT state FROM rooms WHERE code = ${code} AND expires_at > now()`;
    if (rows.length === 0) return ok(res, { ok: true });

    const next = leaveRoom(rows[0].state, clientId);
    if (next === null) {
      await q`DELETE FROM rooms WHERE code = ${code}`;
    } else {
      await q`
        UPDATE rooms
        SET state = ${JSON.stringify(next)}::jsonb,
            expires_at = now() + (${TTL_LOBBY_MIN} * interval '1 minute')
        WHERE code = ${code}
      `;
    }
    ok(res, { ok: true });
  });
}
