import { sql } from './_lib/db.js';
import { ok, err, withSetup } from './_lib/http.js';
import { normalizeCode, RoomError } from './_lib/room-logic.js';
import { sleep, computeStateKey } from './_lib/util.js';

const LONG_POLL_BUDGET_MS = 7000;
const INNER_POLL_MS = 700;

export default async function handler(req, res) {
  await withSetup(req, res, async () => {
    if (req.method !== 'GET') return err(res, 405, 'METHOD', 'GET only');
    const code = normalizeCode(req.query?.code);
    if (!code) return err(res, 400, 'BAD_REQUEST', 'code required');

    const since = req.query?.since;
    const wait = req.query?.wait === '1';
    const q = sql();
    const startMs = Date.now();

    while (true) {
      const rows = await q`SELECT state FROM rooms WHERE code = ${code} AND expires_at > now()`;
      if (rows.length === 0) throw new RoomError('ROOM_NOT_FOUND', 'Room expired or not found');

      const state = rows[0].state;
      const key = computeStateKey(state);

      if (!wait || !since || key !== since) {
        return ok(res, { state, key });
      }

      if (Date.now() - startMs >= LONG_POLL_BUDGET_MS) {
        return ok(res, { state, key, unchanged: true });
      }
      await sleep(INNER_POLL_MS);
    }
  });
}
