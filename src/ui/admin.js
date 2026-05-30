let root = null;
let pollTimer = null;
let currentStats = null;
let currentRooms = [];

async function api(path, opts = {}) {
  const resp = await fetch(path, {
    method: opts.method || 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const err = new Error(json.message || `HTTP ${resp.status}`);
    err.code = json.error || `HTTP_${resp.status}`;
    err.status = resp.status;
    throw err;
  }
  return json;
}

function fmtAge(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function fmtTs(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString();
}

let pinModeHint = null;

function pinHintLabel() {
  if (pinModeHint === 'day') return ' (+ today\'s DD)';
  if (pinModeHint === 'hourly') return ' (+ DDHH today, IST)';
  return '';
}

function renderLogin(message = '') {
  root.innerHTML = `
    <header class="brand">
      <h1>Sūtradhāra</h1>
      <p class="tagline">The one who holds the thread</p>
    </header>
    <form id="admin-login" class="admin-login">
      <label class="join-field">
        <span>PIN${pinHintLabel()}</span>
        <input type="password" name="pin" autocomplete="off" required minlength="6" autofocus>
      </label>
      <div class="setup-actions">
        <a href="#home" class="cancel">Cancel</a>
        <button type="submit" class="primary">Sign in</button>
      </div>
      ${message ? `<p class="form-error">${message}</p>` : ''}
    </form>
  `;
  root.querySelector('#admin-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = e.target.elements.pin.value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const resp = await api('/api/admin/login', { method: 'POST', body: { pin } });
      pinModeHint = resp.mode || null;
      startDashboard();
    } catch (err) {
      renderLogin(err.message || 'Login failed');
    }
  });
}

function showToast(text, kind = 'info') {
  if (!root) return;
  const t = document.createElement('div');
  t.className = `toast ${kind === 'info' ? 'toast-info' : ''}`;
  t.textContent = text;
  root.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

async function loadDashboardData() {
  try {
    const [stats, rooms] = await Promise.all([
      api('/api/admin/stats'),
      api('/api/admin/rooms'),
    ]);
    currentStats = stats;
    currentRooms = rooms.rooms;
    return true;
  } catch (err) {
    if (err.status === 401) {
      renderLogin('Session expired — sign in again');
      return false;
    }
    showToast(err.message || 'Could not load admin data');
    return false;
  }
}

function statsCardsHtml() {
  if (!currentStats) return '';
  const usage = `${currentStats.activeRooms} / ${currentStats.maxRooms}`;
  const pct = currentStats.maxRooms > 0 ? Math.round((currentStats.activeRooms / currentStats.maxRooms) * 100) : 0;
  const oldest = currentStats.oldest;
  return `
    <section class="admin-stats">
      <div class="admin-stat">
        <span class="admin-stat-label">Rooms in use</span>
        <span class="admin-stat-value">${usage}</span>
        <span class="admin-stat-sub">${pct}% of cap</span>
      </div>
      <div class="admin-stat">
        <span class="admin-stat-label">By status</span>
        <span class="admin-stat-value">${Object.entries(currentStats.byStatus || {}).map(([s, n]) => `${s}:${n}`).join(' · ') || '—'}</span>
        <span class="admin-stat-sub">lobby · in-progress · ended</span>
      </div>
      <div class="admin-stat">
        <span class="admin-stat-label">Oldest room</span>
        <span class="admin-stat-value">${oldest ? oldest.code : '—'}</span>
        <span class="admin-stat-sub">${oldest ? fmtAge(oldest.age_sec) + ' old' : ''}</span>
      </div>
      <div class="admin-stat">
        <span class="admin-stat-label">Failed logins (24h)</span>
        <span class="admin-stat-value">${currentStats.failedLogins24h}</span>
        <span class="admin-stat-sub">attempts blocked</span>
      </div>
    </section>
  `;
}

function configHtml() {
  const dbOverride = currentStats?.config?.find(c => c.key === 'maxRooms');
  const envVal = currentStats?.maxRoomsEnv ?? '—';
  const effective = currentStats?.maxRooms ?? '—';
  return `
    <section class="admin-section">
      <h2>Config</h2>
      <div class="admin-config-row">
        <div>
          <strong>MAX_ROOMS</strong>
          <div class="admin-config-meta">
            env=${envVal} · effective=${effective}
            ${dbOverride ? `· DB override since ${fmtTs(dbOverride.updated_at)}` : ''}
          </div>
        </div>
        <form id="config-form" class="admin-config-form">
          <input type="number" name="maxRooms" min="1" max="500" value="${effective}" required>
          <button type="submit" class="ghost">Set</button>
          ${dbOverride ? `<button type="button" id="clear-override" class="ghost">Clear override</button>` : ''}
        </form>
      </div>
    </section>
  `;
}

function roomsTableHtml() {
  if (!currentRooms.length) {
    return `
      <section class="admin-section">
        <h2>Live rooms</h2>
        <p class="admin-empty">No active rooms.</p>
      </section>
    `;
  }
  return `
    <section class="admin-section">
      <div class="admin-section-head">
        <h2>Live rooms (${currentRooms.length})</h2>
        <button type="button" id="wipe-all" class="ghost danger-line">Nuke all</button>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Status</th>
              <th>Host</th>
              <th>Players</th>
              <th>Moves</th>
              <th>Board</th>
              <th>Age</th>
              <th>TTL</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${currentRooms.map(r => `
              <tr>
                <td class="admin-code">${r.code}</td>
                <td><span class="admin-pill admin-pill-${r.status}">${r.status}</span></td>
                <td>${r.hostName || '—'}</td>
                <td>${r.playersIn} / ${r.playerCap}</td>
                <td>${r.moves}</td>
                <td>${r.rows ?? '?'}×${r.cols ?? '?'} ${r.shape || ''}</td>
                <td>${fmtAge(r.ageSec)}</td>
                <td>${fmtAge(Math.max(0, r.ttlSec))}</td>
                <td>
                  ${r.status === 'in-progress' ? `<button type="button" class="admin-action" data-action="end" data-code="${r.code}">End</button>` : ''}
                  <button type="button" class="admin-action danger-line" data-action="delete" data-code="${r.code}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function auditHtml() {
  const items = currentStats?.recentAudit || [];
  if (!items.length) return '';
  return `
    <section class="admin-section">
      <h2>Recent admin actions</h2>
      <ul class="admin-audit">
        ${items.map(a => `
          <li>
            <span class="admin-audit-action">${a.action}</span>
            <span class="admin-audit-details">${a.details ? JSON.stringify(a.details) : ''}</span>
            <span class="admin-audit-ts">${fmtTs(a.created_at)} · ${a.ip || ''}</span>
          </li>
        `).join('')}
      </ul>
    </section>
  `;
}

function renderDashboard() {
  if (!root) return;
  root.innerHTML = `
    <header class="brand admin-brand">
      <div>
        <h1>Sūtradhāra</h1>
        <p class="tagline">Rangoli Royale control room${pinModeHint ? ` · ${pinModeHint}-PIN mode` : ''}${currentStats?.hasPrefix ? ' · BIJA bound' : ''}</p>
      </div>
      <div class="admin-actions">
        <button type="button" id="refresh-all" class="ghost">↻ Refresh</button>
        <button type="button" id="logout" class="ghost">Sign out</button>
      </div>
    </header>
    ${statsCardsHtml()}
    ${configHtml()}
    ${roomsTableHtml()}
    ${auditHtml()}
    <p class="admin-footer">
      Session signed cookie · auto-expires in 4 hours · all actions audited.
      <a href="#home">Back to game</a>
    </p>
  `;

  root.querySelector('#logout')?.addEventListener('click', async () => {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch {}
    renderLogin('Signed out');
  });

  root.querySelector('#refresh-all')?.addEventListener('click', async () => {
    const btn = root.querySelector('#refresh-all');
    btn.disabled = true;
    btn.textContent = '↻ Loading…';
    await loadDashboardData();
    renderDashboard();
  });

  root.querySelector('#wipe-all')?.addEventListener('click', async () => {
    if (!confirm('Delete EVERY active room? Any player currently in a room will be kicked out. This cannot be undone.')) return;
    try {
      const r = await api('/api/admin/rooms', { method: 'DELETE' });
      showToast(`Deleted ${r.deleted} room(s)`);
      await loadDashboardData();
      renderDashboard();
    } catch (err) {
      showToast(err.message || 'Wipe failed');
    }
  });

  root.querySelectorAll('button.admin-action').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.action;
      const code = btn.dataset.code;
      if (action === 'delete') {
        if (!confirm(`Delete room ${code}? Players will be kicked out.`)) return;
        try {
          await api(`/api/admin/room/${encodeURIComponent(code)}`, { method: 'DELETE' });
          showToast(`Deleted ${code}`);
        } catch (err) { showToast(err.message); return; }
      } else if (action === 'end') {
        if (!confirm(`Force-end room ${code}? Players see "Ended by admin" on their endgame screen.`)) return;
        try {
          await api(`/api/admin/room/${encodeURIComponent(code)}`, { method: 'POST' });
          showToast(`Ended ${code}`);
        } catch (err) { showToast(err.message); return; }
      }
      await loadDashboardData();
      renderDashboard();
    });
  });

  root.querySelector('#config-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = parseInt(e.target.elements.maxRooms.value, 10);
    if (!Number.isFinite(value) || value < 1) { showToast('Bad value'); return; }
    try {
      await api('/api/admin/config', { method: 'POST', body: { key: 'maxRooms', value } });
      showToast(`MAX_ROOMS override = ${value}`);
      await loadDashboardData();
      renderDashboard();
    } catch (err) { showToast(err.message); }
  });

  root.querySelector('#clear-override')?.addEventListener('click', async () => {
    if (!confirm('Clear DB override and fall back to env-var MAX_ROOMS?')) return;
    try {
      await api('/api/admin/config?key=maxRooms', { method: 'DELETE' });
      showToast('Override cleared');
      await loadDashboardData();
      renderDashboard();
    } catch (err) { showToast(err.message); }
  });
}

async function startDashboard() {
  const ok = await loadDashboardData();
  if (!ok) return;
  renderDashboard();
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (document.hidden) return;
    const ok2 = await loadDashboardData();
    if (ok2) renderDashboard();
  }, 5000);
}

export async function mount(target) {
  root = target;
  try {
    const me = await api('/api/admin/me');
    pinModeHint = me.mode || null;
    startDashboard();
  } catch (err) {
    if (err.code === 'NO_CONFIG') {
      root.innerHTML = `
        <header class="brand"><h1>Sūtradhāra · not configured</h1></header>
        <section class="screen-error">
          <h2>Server is missing admin secrets</h2>
          <p class="screen-error-detail">Set <code>ADMIN_PIN_HASH</code> and <code>ADMIN_COOKIE_SECRET</code> in Vercel env vars, then redeploy.</p>
          <p>Run <code>node scripts/hash-admin-pin.mjs</code> locally to generate them.</p>
          <div class="screen-error-actions">
            <a href="#home" class="ghost-link">Back to game</a>
          </div>
        </section>
      `;
      return;
    }
    renderLogin();
  }
}

export function unmount() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  root = null;
  currentStats = null;
  currentRooms = [];
}
