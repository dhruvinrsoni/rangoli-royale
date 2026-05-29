import {
  getCurrentGame as storageGet,
  saveCurrentGame as storageSave,
  clearCurrentGame as storageClear,
} from './storage.js';
import { applyMove, undoLastMove } from './turn-engine.js';

let activeAdapter = null;
const subscribers = new Set();

function emit(state) {
  for (const fn of subscribers) {
    try { fn(state); } catch (err) { console.error('[sync-adapter] subscriber', err); }
  }
}

export const localAdapter = Object.freeze({
  kind: 'local',
  startSession(state) {
    storageSave(state);
    emit(state);
    return Promise.resolve({ ok: true });
  },
  loadSession() {
    return Promise.resolve(storageGet());
  },
  submitMove(edgeId) {
    const state = storageGet();
    if (!state) throw new Error('no active session');
    const next = applyMove(state, edgeId);
    storageSave(next);
    emit(next);
    return Promise.resolve(next);
  },
  submitUndo() {
    const state = storageGet();
    if (!state) throw new Error('no active session');
    const next = undoLastMove(state);
    storageSave(next);
    emit(next);
    return Promise.resolve(next);
  },
  endSession(state) {
    if (state) storageSave(state);
    emit(state ?? null);
    return Promise.resolve();
  },
  leaveSession() {
    storageClear();
    emit(null);
    return Promise.resolve();
  },
});

export function setAdapter(adapter) {
  activeAdapter = adapter;
}

export function getAdapter() {
  return activeAdapter ?? localAdapter;
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
