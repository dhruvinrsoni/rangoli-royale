const listeners = new Map();

export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

export function off(event, handler) {
  const set = listeners.get(event);
  if (set) set.delete(handler);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const handler of set) {
    try { handler(payload); } catch (err) { console.error('[event handler]', event, err); }
  }
}

export function clear(event) {
  if (event) listeners.delete(event);
  else listeners.clear();
}
