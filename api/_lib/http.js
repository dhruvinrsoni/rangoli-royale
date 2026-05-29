import { ensureSchema, sweepExpired } from './db.js';

export async function readBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    return req.body;
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function ok(res, data, status = 200) {
  cors(res);
  res.setHeader('Content-Type', 'application/json');
  res.status(status).end(JSON.stringify(data));
}

export function err(res, status, code, message) {
  cors(res);
  res.setHeader('Content-Type', 'application/json');
  res.status(status).end(JSON.stringify({ error: code, message }));
}

export async function withSetup(req, res, fn) {
  cors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  try {
    await ensureSchema();
    sweepExpired().catch(() => {});
    await fn();
  } catch (e) {
    console.error('[api]', e);
    if (e.code && e.message) {
      const map = { ROOM_FULL: 409, ROOM_STARTED: 409, NOT_HOST: 403, NOT_ENOUGH: 400, BAD_STATE: 409, NOT_IN_ROOM: 403, INVALID_MOVE: 400, WRONG_TEAM: 403, ROOM_NOT_FOUND: 404, CAPACITY: 429, RATE_LIMITED: 429, CONFLICT: 409 };
      return err(res, map[e.code] ?? 400, e.code, e.message);
    }
    err(res, 500, 'INTERNAL', 'Server error');
  }
}
