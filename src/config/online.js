const HEALTH_TIMEOUT_MS = 2500;
let cached = null;

export async function checkOnlineAvailable() {
  if (cached) return cached;
  if (typeof window === 'undefined') return { available: false, max: 0, active: 0 };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
  try {
    const resp = await fetch('/api/health', { signal: ctrl.signal });
    if (!resp.ok) throw new Error('health ' + resp.status);
    const json = await resp.json();
    cached = { available: true, max: json.max ?? 10, active: json.active ?? 0 };
  } catch {
    cached = { available: false, max: 0, active: 0 };
  } finally {
    clearTimeout(timer);
  }
  return cached;
}

export function resetOnlineCache() {
  cached = null;
}

export function getClientId() {
  const KEY = 'rangoli-royale:clientId';
  let id = null;
  try { id = localStorage.getItem(KEY); } catch {}
  if (!id) {
    id = 'c-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    try { localStorage.setItem(KEY, id); } catch {}
  }
  return id;
}
