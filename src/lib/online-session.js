import { getClientId } from '../config/online.js';

const SESSION_KEY = 'rangoli-royale:online-session';
const NAME_KEY = 'rangoli-royale:online-name';

const BACKOFF_ON_ERROR_MS = 2500;
const SLOW_POLL_HIDDEN_MS = 30000;

let session = null;
let pollAbort = null;
let listeners = new Set();
let lastEmittedKey = null;
let pollLoopActive = false;

function stateKey(state) {
  if (!state) return 'null';
  const players = state.players?.map(p => `${p.seat}:${p.team}:${p.clientId?.slice(-4) || ''}`).join(',') || '';
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

function sleep(ms, signal) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

function isHidden() {
  return typeof document !== 'undefined' && document.hidden;
}

async function pollLoop() {
  if (pollLoopActive) return;
  pollLoopActive = true;
  while (session) {
    if (isHidden()) {
      pollAbort = new AbortController();
      await sleep(SLOW_POLL_HIDDEN_MS, pollAbort.signal);
      pollAbort = null;
      continue;
    }
    try {
      pollAbort = new AbortController();
      const url = `/api/${encodeURIComponent(session.code)}?wait=1&since=${encodeURIComponent(lastEmittedKey ?? '')}`;
      const resp = await fetch(url, { cache: 'no-store', signal: pollAbort.signal });
      pollAbort = null;
      if (!session) break;
      if (resp.status === 404) {
        const code = session.code;
        stop();
        notify({ kind: 'room-gone', code });
        break;
      }
      if (!resp.ok) {
        notify({ kind: 'network-error', status: resp.status });
        await sleep(BACKOFF_ON_ERROR_MS);
        continue;
      }
      const json = await resp.json();
      if (json.state) {
        const newKey = json.key ?? stateKey(json.state);
        if (newKey !== lastEmittedKey) {
          lastEmittedKey = newKey;
          session.state = json.state;
          persist();
          notify({ kind: 'state', state: json.state });
        }
      }
    } catch (err) {
      if (err?.name === 'AbortError') continue;
      notify({ kind: 'network-error', error: err });
      await sleep(BACKOFF_ON_ERROR_MS);
    }
  }
  pollLoopActive = false;
}

function kick() {
  if (pollAbort) {
    try { pollAbort.abort(); } catch {}
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) kick();
  });
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
  kick();
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

function adoptState(state) {
  if (!session) return;
  const key = stateKey(state);
  session.state = state;
  lastEmittedKey = key;
  persist();
  notify({ kind: 'state', state });
}

export async function createRoom(setup, hostName) {
  const clientId = getClientId();
  const json = await api('/api/create', { body: { setup, hostName, clientId } });
  session = { code: json.code, clientId, state: json.state, mySeat: 1, name: hostName };
  rememberName(hostName);
  lastEmittedKey = stateKey(json.state);
  persist();
  pollLoop();
  return session;
}

export async function joinRoom(code, name) {
  const clientId = getClientId();
  const json = await api(`/api/${encodeURIComponent(code)}/join`, { body: { clientId, name } });
  session = { code: code.toUpperCase(), clientId, state: json.state, mySeat: json.seat, name };
  rememberName(name);
  lastEmittedKey = stateKey(json.state);
  persist();
  pollLoop();
  return session;
}

export async function startRoom() {
  if (!session) throw new Error('No session');
  const json = await api(`/api/${encodeURIComponent(session.code)}/start`, { body: { clientId: session.clientId } });
  adoptState(json.state);
  return json.state;
}

export async function submitMoveOnline(edgeId) {
  if (!session) throw new Error('No session');
  const expectedMoves = session.state?.moveLog?.length ?? 0;
  const json = await api(`/api/${encodeURIComponent(session.code)}/move`, {
    body: { clientId: session.clientId, edgeId, expectedMoves },
  });
  adoptState(json.state);
  return json.state;
}

export async function giveUpOnline() {
  if (!session) throw new Error('No session');
  const json = await api(`/api/${encodeURIComponent(session.code)}/give-up`, {
    body: { clientId: session.clientId },
  });
  adoptState(json.state);
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
  session = null;
  lastEmittedKey = null;
  kick();
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
  pollLoop();
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
