import { getSession, onUpdate, startRoom, leaveRoom, isHost, refresh } from '../lib/online-session.js';
import { saveCurrentGame, clearCurrentGame } from '../lib/storage.js';

let unsub = null;
let root = null;

function buildShareUrl(code) {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#join?code=${code}`;
}

function render() {
  const session = getSession();
  if (!root) return;
  if (!session) {
    root.innerHTML = `
      <header class="brand"><h1>Room ended</h1></header>
      <p class="screen-error"><a href="#home" class="primary">Home</a></p>
    `;
    return;
  }

  const state = session.state;
  if (state.status === 'in-progress') {
    saveCurrentGame({
      setup: state.setup,
      moveLog: state.moveLog,
      status: state.status,
    });
    location.hash = '#game';
    return;
  }
  if (state.status === 'ended') {
    location.hash = '#endgame';
    return;
  }

  const shareUrl = buildShareUrl(session.code);
  const seatsFilled = state.players.length;
  const seatsTotal = state.setup.playerCount;
  const canStart = isHost() && seatsFilled >= 2;
  const a = state.setup.teams.A;
  const b = state.setup.teams.B;

  root.innerHTML = `
    <header class="brand">
      <h1>Lobby</h1>
      <p class="tagline">Share the code. Wait for players. Host starts the game.</p>
    </header>

    <section class="lobby-code">
      <span class="lobby-code-label">Room code</span>
      <div class="lobby-code-value" id="code-value">${session.code}</div>
      <button type="button" id="copy-code" class="ghost">Copy code</button>
      <button type="button" id="copy-link" class="ghost">Copy invite link</button>
    </section>

    <section class="lobby-meta">
      <div class="lobby-meta-row">
        <span>Game</span>
        <span>${state.setup.rows}×${state.setup.cols} · ${state.setup.shape} · ${state.setup.winMode === 'tree' ? 'tree' : 'line'} mode</span>
      </div>
      <div class="lobby-meta-row">
        <span>Teams</span>
        <span><span class="dot" style="background:${a.color}"></span>${a.name} vs <span class="dot" style="background:${b.color}"></span>${b.name}</span>
      </div>
      <div class="lobby-meta-row">
        <span>Seats</span>
        <span>${seatsFilled} of ${seatsTotal}</span>
      </div>
    </section>

    <section class="lobby-players">
      <h2>Players</h2>
      <ul>
        ${state.players.map(p => `
          <li class="lobby-player" style="--team-color:${state.setup.teams[p.team].color}">
            <span class="lobby-player-seat">#${p.seat}</span>
            <span class="lobby-player-name">${p.name}${p.clientId === session.clientId ? ' (you)' : ''}</span>
            <span class="lobby-player-team">${state.setup.teams[p.team].name}</span>
          </li>
        `).join('')}
        ${Array.from({ length: Math.max(0, seatsTotal - seatsFilled) }, (_, i) => `
          <li class="lobby-player lobby-player-empty">
            <span class="lobby-player-seat">#${seatsFilled + i + 1}</span>
            <span class="lobby-player-name">Waiting…</span>
          </li>
        `).join('')}
      </ul>
    </section>

    <div class="lobby-actions">
      ${canStart ? `<button type="button" id="start-game" class="primary">Start game</button>` : ''}
      ${isHost() && !canStart ? `<p class="lobby-hint">Need at least 2 players to start</p>` : ''}
      ${!isHost() ? `<p class="lobby-hint">Waiting for host to start…</p>` : ''}
      <button type="button" id="refresh" class="ghost">↻ Refresh</button>
      <button type="button" id="leave" class="ghost">Leave room</button>
    </div>
  `;

  root.querySelector('#copy-code')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(session.code); toast('Code copied'); } catch {}
  });
  root.querySelector('#copy-link')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareUrl); toast('Link copied'); } catch {}
  });
  root.querySelector('#start-game')?.addEventListener('click', async () => {
    const btn = root.querySelector('#start-game');
    btn.disabled = true;
    btn.textContent = 'Starting…';
    try { await startRoom(); } catch (err) { toast(err.message || 'Could not start'); btn.disabled = false; btn.textContent = 'Start game'; }
  });
  root.querySelector('#refresh')?.addEventListener('click', async () => {
    const btn = root.querySelector('#refresh');
    btn.disabled = true;
    btn.textContent = '↻ Refreshing…';
    try { await refresh(); } finally { btn.disabled = false; btn.textContent = '↻ Refresh'; }
  });

  root.querySelector('#leave')?.addEventListener('click', async () => {
    if (!confirm('Leave the room?')) return;
    await leaveRoom();
    clearCurrentGame();
    location.hash = '#home';
  });
}

function toast(text) {
  if (!root) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  root.appendChild(t);
  setTimeout(() => t.remove(), 1600);
}

export function mount(target) {
  root = target;
  const session = getSession();
  if (!session) {
    target.innerHTML = `
      <header class="brand"><h1>No active room</h1></header>
      <p class="screen-error"><a href="#home" class="primary">Home</a></p>
    `;
    return;
  }
  render();
  unsub = onUpdate(() => render());
}

export function unmount() {
  if (unsub) { unsub(); unsub = null; }
  root = null;
}
