import { sql, getMaxRooms, activeRoomCount, TTL_LOBBY_MIN } from './_lib/db.js';
import { ok, err, readBody, withSetup } from './_lib/http.js';
import { generateCode, makeInitialRoomState, RoomError } from './_lib/room-logic.js';

export default async function handler(req, res) {
  await withSetup(req, res, async () => {
    if (req.method !== 'POST') return err(res, 405, 'METHOD', 'POST only');
    const body = await readBody(req);
    const { setup, hostName, clientId } = body || {};
    if (!setup || !clientId) return err(res, 400, 'BAD_REQUEST', 'setup + clientId required');

    const active = await activeRoomCount();
    const max = getMaxRooms();
    if (active >= max) {
      throw new RoomError('CAPACITY', `All ${max} rooms in use. Try again in a few minutes or start a local game.`);
    }

    const q = sql();
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const state = makeInitialRoomState({ setup, hostName, hostClientId: clientId });
      const rows = await q`
        INSERT INTO rooms (code, state, expires_at)
        VALUES (${code}, ${JSON.stringify(state)}::jsonb, now() + (${TTL_LOBBY_MIN} * interval '1 minute'))
        ON CONFLICT (code) DO NOTHING
        RETURNING code
      `;
      if (rows.length > 0) {
        ok(res, { code, state }, 201);
        return;
      }
    }
    err(res, 500, 'CODE_GEN', 'Could not generate a unique code');
  });
}
