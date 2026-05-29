import { ensureSchema, getMaxRooms, activeRoomCount } from './_lib/db.js';
import { ok, err, cors } from './_lib/http.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    await ensureSchema();
    const active = await activeRoomCount();
    ok(res, { ok: true, active, max: getMaxRooms() });
  } catch (e) {
    console.error('[health]', e);
    err(res, 500, 'INTERNAL', 'Backend unavailable');
  }
}
