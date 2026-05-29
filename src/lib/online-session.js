import { getClientId } from '../config/online.js';

const POLL_OPPONENT_TURN_MS = 1500;
const POLL_LOBBY_MS = 2000;
const POLL_MY_TURN_MS = 5000;
const POLL_ENDED_MS = 8000;
const SESSION_KEY = 'rangoli-royale:online-session';
const NAME_KEY = 'rangoli-royale:online-name';

let session = null;
let pollTimer = null;
let listeners = new Set();
let lastEmittedKey = null;

function stateKey(state) {
  if (!state) return 'null';
  const players = state.players?.map(p => `${p.seat}:${p.team}:${p.clientId.slice(-4)}`).join(',') || '';
  return [
    state.moveLog?.length ?? 0,
    state.status,
    state.players?.length ?? 0,
    state.hostSeat ?? '',
    state.endReason ?? '',
    players,
  ].join('|');
}

function notify(evt) {
  for (const fn of listeners) {
    try { fn(evt); } catch (err) { console.error('[online]', err); }
  }
}

function persist() {
  try {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      code: session.code,
      clientId: session.clientId,
      mySeat: session.mySeat,
      name: session.name,
      lastState: session.state,
      ts: Date.now(),
    }));
  } catch {}
}

export function rememberName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch {}
}

export function getRememberedName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}

async function pollOnce() {
  if (!session) return;
  const url = `/api/${encodeURIComponent(session.code)}`;
  try {
    const resp = await fetch(url, { cache: 'no-store' });
    if (resp.status === 404) {
      const code = session.code;
      stop();
      notify({ kind: 'room-gone', code });
      return;
    }
    if (!resp.ok) {
      notify({ kind: 'network-error', status: resp.status });
      return;
    }
    const json = await resp.json();
    const key = stateKey(json.state);
    session.state = json.state;
    persist();
    if (key !== lastEmittedKey) {
      lastEmittedKey = key;
      notify({ kind: 'state', state: json.state });
    }
  } catch (err) {
    notify({ kind: 'network-error', error: err });
  }
}

function nextInterval() {
  const state = session?.state;
  if (!state) return POLL_LOBBY_MS;
  if (state.status === 'lobby') return POLL_LOBBY_MS;
  if (state.status === 'ended') return POLL_ENDED_MS;
  const myTeam = getMyTeam();
  if (!myTeam || state.moveLog.length === 0) {
    return state.setup.startingTeam === myTeam ? POLL_MY_TURN_MS : POLL_OPPONENT_TURN_MS;
  }
  const last = state.moveLog[state.moveLog.length - 1];
  return last.team === myTeam ? POLL_OPPONENT_TURN_MS : POLL_MY_TURN_MS;
}

function schedule() {
  clearTimeout(pollTimer);
  if (!session) return;
  pollTimer = setTimeout(async () => {
    await pollOnce();
    schedule();
  }, nextInterval());
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

export async function refresh() {
  await pollOnce();
}

async function api(path, opts = {}) {
  const resp = await fetch(path, {
    method: opts.method || 'POST',
    cache: 'no-store',
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
  session = { code: json.code, clientId, state: json.state, mySeat: 1, name: hostName };
  rememberName(hostName);
  persist();
  schedule();
  return session;
}

export async function joinRoom(code, name) {
  const clientId = getClientId();
  const json = await api(`/api/${encodeURIComponent(code)}/join`, { body: { clientId, name } });
  session = { code: code.toUpperCase(), clientId, state: json.state, mySeat: json.seat, name };
  rememberName(name);
  persist();
  schedule();
  return session;
}

export async function startRoom() {
  if (!session) throw new Error('No session');
  const json = await api(`/api/${encodeURIComponent(session.code)}/start`, { body: { clientId: session.clientId } });
  session.state = json.state;
  lastEmittedKey = stateKey(json.state);
  persist();
  notify({ kind: 'state', state: json.state });
  return json.state;
}

export async function submitMoveOnline(edgeId) {
  if (!session) throw new Error('No session');
  const expectedMoves = session.state?.moveLog?.length ?? 0;
  const json = await api(`/api/${encodeURIComponent(session.code)}/move`, {
    body: { clientId: session.clientId, edgeId, expectedMoves },
  });
  session.state = json.state;
  lastEmittedKey = stateKey(json.state);
  persist();
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
  lastEmittedKey = null;
  persist();
}

export function restoreSessionSync() {
  if (session) return session;
  let stored = null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {}
  if (!stored?.code || !stored?.clientId) return null;
  session = {
    code: stored.code,
    clientId: stored.clientId,
    mySeat: stored.mySeat ?? null,
    name: stored.name || '',
    state: stored.lastState || null,
  };
  lastEmittedKey = stateKey(session.state);
  schedule();
  pollOnce();
  return session;
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
