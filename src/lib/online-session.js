import { getClientId } from '../config/online.js';

const POLL_FAST_MS = 2500;
const POLL_SLOW_MS = 6000;

let session = null;
let pollTimer = null;
let listeners = new Set();
let lastMoveCount = -1;

function notify(state) {
  for (const fn of listeners) {
    try { fn(state); } catch (err) { console.error('[online]', err); }
  }
}

async function pollOnce() {
  if (!session) return;
  const url = `/api/${encodeURIComponent(session.code)}?since=${lastMoveCount}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      if (resp.status === 404) {
        stop();
        notify({ kind: 'room-gone' });
      }
      return;
    }
    const json = await resp.json();
    if (json.hasUpdate || lastMoveCount === -1) {
      session.state = json.state;
      lastMoveCount = json.state.moveLog?.length ?? 0;
      notify({ kind: 'state', state: json.state });
    }
  } catch (err) {
    notify({ kind: 'network-error', error: err });
  }
}

function schedule() {
  clearTimeout(pollTimer);
  if (!session) return;
  const status = session.state?.status;
  const interval = status === 'in-progress' || status === 'lobby' ? POLL_FAST_MS : POLL_SLOW_MS;
  pollTimer = setTimeout(async () => {
    await pollOnce();
    schedule();
  }, interval);
}

export function isActive() {
  return session !== null;
}

export function getSession() {
  return session ? { ...session } : null;
}

export function onUpdate(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function api(path, opts = {}) {
  const resp = await fetch(path, {
    method: opts.method || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(json.message || 'Request failed');
    err.code = json.error || `HTTP_${resp.status}`;
    err.status = resp.status;
    throw err;
  }
  return json;
}

export async function createRoom(setup, hostName) {
  const clientId = getClientId();
  const json = await api('/api/create', { body: { setup, hostName, clientId } });
  session = { code: json.code, clientId, state: json.state, mySeat: 1 };
  lastMoveCount = json.state.moveLog?.length ?? 0;
  schedule();
  return session;
}

export async function joinRoom(code, name) {
  const clientId = getClientId();
  const json = await api(`/api/${encodeURIComponent(code)}/join`, { body: { clientId, name } });
  session = { code, clientId, state: json.state, mySeat: json.seat };
  lastMoveCount = json.state.moveLog?.length ?? 0;
  schedule();
  return session;
}

export async function startRoom() {
  if (!session) throw new Error('No session');
  const json = await api(`/api/${encodeURIComponent(session.code)}/start`, { body: { clientId: session.clientId } });
  session.state = json.state;
  lastMoveCount = json.state.moveLog?.length ?? 0;
  notify({ kind: 'state', state: json.state });
  return json.state;
}

export async function submitMoveOnline(edgeId) {
  if (!session) throw new Error('No session');
  const expectedMoves = session.state.moveLog?.length ?? 0;
  const json = await api(`/api/${encodeURIComponent(session.code)}/move`, {
    body: { clientId: session.clientId, edgeId, expectedMoves },
  });
  session.state = json.state;
  lastMoveCount = json.state.moveLog?.length ?? 0;
  notify({ kind: 'state', state: json.state });
  return json.state;
}

export async function leaveRoom() {
  if (!session) return;
  const code = session.code;
  const clientId = session.clientId;
  stop();
  try {
    await api(`/api/${encodeURIComponent(code)}/leave`, { body: { clientId } });
  } catch {}
}

export function stop() {
  clearTimeout(pollTimer);
  pollTimer = null;
  session = null;
  lastMoveCount = -1;
}

export function getMyTeam() {
  if (!session?.state?.players) return null;
  const me = session.state.players.find(p => p.clientId === session.clientId);
  return me?.team ?? null;
}

export function isMyTurn() {
  if (!session?.state) return false;
  const state = session.state;
  if (state.status !== 'in-progress') return false;
  if (state.moveLog.length === 0) return state.setup.startingTeam === getMyTeam();
  const last = state.moveLog[state.moveLog.length - 1];
  return last.team !== getMyTeam();
}

export function isHost() {
  if (!session?.state) return false;
  const host = session.state.players.find(p => p.seat === session.state.hostSeat);
  return host?.clientId === session.clientId;
}
