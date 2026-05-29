const PREFIX = 'rangoli-royale:';
const KEYS = Object.freeze({
  setup: PREFIX + 'setup',
  currentGame: PREFIX + 'current-game',
  history: PREFIX + 'history',
  settings: PREFIX + 'settings',
});

function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key) {
  try { localStorage.removeItem(key); } catch {}
}

export const getSetup = () => read(KEYS.setup);
export const saveSetup = (setup) => write(KEYS.setup, setup);

const LEGACY_EDGE_ID = /^[hv]-\d+-\d+$/;

function isLegacyGame(state) {
  if (!state || !Array.isArray(state.moveLog)) return false;
  return state.moveLog.some(m => m && typeof m.edgeId === 'string' && LEGACY_EDGE_ID.test(m.edgeId));
}

export const getCurrentGame = () => {
  const state = read(KEYS.currentGame);
  if (isLegacyGame(state)) {
    remove(KEYS.currentGame);
    return null;
  }
  return state;
};
export const saveCurrentGame = (state) => write(KEYS.currentGame, state);
export const clearCurrentGame = () => remove(KEYS.currentGame);

export const getHistory = () => read(KEYS.history, []);
export const appendHistory = (entry) => {
  const history = getHistory();
  history.unshift(entry);
  if (history.length > 200) history.length = 200;
  return write(KEYS.history, history);
};
export const clearHistory = () => write(KEYS.history, []);

export const getSettings = () => read(KEYS.settings, {});
export const saveSettings = (settings) => write(KEYS.settings, settings);
export const updateSettings = (patch) => saveSettings({ ...getSettings(), ...patch });

export function fullReset() {
  for (const key of Object.values(KEYS)) remove(key);
}

export function exportAll() {
  return {
    setup: getSetup(),
    currentGame: getCurrentGame(),
    history: getHistory(),
    settings: getSettings(),
    exportedAt: new Date().toISOString(),
  };
}

export function importAll(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('invalid import payload');
  if (payload.setup !== undefined) saveSetup(payload.setup);
  if (payload.currentGame !== undefined) {
    if (payload.currentGame === null) clearCurrentGame();
    else saveCurrentGame(payload.currentGame);
  }
  if (Array.isArray(payload.history)) write(KEYS.history, payload.history);
  if (payload.settings !== undefined) saveSettings(payload.settings);
}

export const STORAGE_KEYS = KEYS;
