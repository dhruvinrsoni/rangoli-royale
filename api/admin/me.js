import { requireAdmin, AdminError } from '../_lib/admin-auth.js';
import { ok, err, cors } from '../_lib/http.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    const session = requireAdmin(req);
    ok(res, { ok: true, expiresAt: session.expiry * 1000 });
  } catch (e) {
    if (e instanceof AdminError) return err(res, e.code === 'NO_CONFIG' ? 503 : 401, e.code, e.message);
    err(res, 500, 'INTERNAL', 'Server error');
  }
}
