import { currentTeam, applyMove, deriveGrid, InvalidMoveError, MoveError, turnNumberForTeam, undoLastMove, legalMovesFor } from '../lib/turn-engine.js';
import { scoreFor } from '../lib/scoring.js';
import { getCurrentGame, saveCurrentGame, clearCurrentGame, getSettings, updateSettings } from '../lib/storage.js';
import { renderGridSvg } from './game-render.js';
import { buzz } from '../features/haptic.js';
import { playMoveBlip, playInvalidBuzz } from '../features/sound-fx.js';
import { isEnabled } from '../config/features.js';
import { isActive as onlineActive, isMyTurn, getMyTeam, getSession, onUpdate as onOnlineUpdate, submitMoveOnline, leaveRoom as leaveOnlineRoom, refresh as refreshOnline, giveUpOnline } from '../lib/online-session.js';

const AUTO_PLAY_DELAY_MS = 1000;

let state = null;
let grid = null;
let root = null;
let unsubOnline = null;
let lastRenderKey = null;
let lastSkipNoticeTurn = -1;
let autoPlayTimer = null;

function teamMeta(team) {
  return state.setup.teams[team];
}

function clearAutoPlay() {
  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer);
    autoPlayTimer = null;
  }
}

function renderKey() {
  if (!state) return 'null';
  const team = currentTeam(state, grid);
  return [
    state.moveLog.length,
    state.status,
    team ?? '',
    onlineActive() ? '1' : '0',
  ].join('|');
}

function bannerHtml(currentTeamName) {
  const team = currentTeam(state, grid);
  if (team === null) return `<div class="turn-banner">Game over</div>`;
  const meta = teamMeta(team);
  const turnNum = turnNumberForTeam(state, team);
  const lastMove = state.moveLog[state.moveLog.length - 1];
  const skipped = lastMove && lastMove.team === team;
  const youLabel = onlineActive()
    ? (team === getMyTeam() ? '· your turn' : '· waiting')
    : '· pass the device';
  return `
    <div class="turn-banner" style="--turn-color:${meta.color}">
      <span class="turn-team">${meta.name}</span>
      <span class="turn-meta">Move #${turnNum} ${youLabel}</span>
      ${skipped ? `<span class="turn-skip">Opponent had no moves — plays again</span>` : ''}
    </div>
  `;
}

function scoreboardHtml() {
  const a = teamMeta('A');
  const b = teamMeta('B');
  return `
    <div class="scoreboard" aria-label="Scoreboard">
      <div class="score" style="--team-color:${a.color}">
        <span class="score-name">${a.name}</span>
        <span class="score-value">${scoreFor(state, 'A')}</span>
      </div>
      <div class="score-divider" aria-hidden="true">vs</div>
      <div class="score" style="--team-color:${b.color}">
        <span class="score-name">${b.name}</span>
        <span class="score-value">${scoreFor(state, 'B')}</span>
      </div>
    </div>
  `;
}

function maybeFireSkipToast() {
  const team = currentTeam(state, grid);
  if (!team) return;
  const lastMove = state.moveLog[state.moveLog.length - 1];
  if (!lastMove || lastMove.team !== team) return;
  if (lastSkipNoticeTurn === state.moveLog.length) return;
  lastSkipNoticeTurn = state.moveLog.length;
  const skippedTeam = team === 'A' ? 'B' : 'A';
  const skippedName = state.setup.teams[skippedTeam].name;
  showToast(`${skippedName} had no legal moves — turn skipped`);
}

function showToast(text) {
  if (!root) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast-info';
  toast.textContent = text;
  root.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

function scheduleAutoPlayIfOnlyOne() {
  clearAutoPlay();
  if (state.status !== 'in-progress') return;
  const team = currentTeam(state, grid);
  if (!team) return;
  if (onlineActive() && team !== getMyTeam()) return;
  const legal = legalMovesFor(state, team, grid);
  if (legal.length !== 1) return;
  const onlyEdge = legal[0];
  const ghostEl = root.querySelector(`.edges-ghost [data-edge="${onlyEdge}"]`);
  if (ghostEl) ghostEl.classList.add('is-only-option');
  autoPlayTimer = setTimeout(() => {
    autoPlayTimer = null;
    if (state?.status === 'in-progress' && currentTeam(state, grid) === team) {
      _handleEdgeTap(onlyEdge);
    }
  }, AUTO_PLAY_DELAY_MS);
}

function render() {
  if (!root) return;

  if (state.status === 'in-progress' && currentTeam(state, grid) === null) {
    state = { ...state, status: 'ended' };
    saveCurrentGame(state);
  }
  if (state.status === 'ended') {
    clearAutoPlay();
    location.hash = '#endgame';
    return;
  }

  const key = renderKey();
  if (key === lastRenderKey) return;
  lastRenderKey = key;

  clearAutoPlay();

  const team = currentTeam(state, grid);
  const teamMetaObj = team ? teamMeta(team) : null;
  const winModeLabel = state.setup.winMode === 'tree' ? 'Largest tree' : 'Longest line';
  const canUndo = !onlineActive() && isEnabled('undoMove') && state.moveLog.length > 0 && state.status === 'in-progress';
  const isOnline = onlineActive();
  const gridHostStyle = teamMetaObj ? `style="--turn-color:${teamMetaObj.color}"` : '';
  const turnTeamAttr = team ? `data-turn-team="${team}"` : '';

  root.innerHTML = `
    <header class="game-header">
      <a href="#home" class="game-back" aria-label="Back to home">← Home</a>
      <span class="game-mode">${winModeLabel}${isOnline ? ' · online' : ''}</span>
    </header>
    ${bannerHtml()}
    ${scoreboardHtml()}
    <section class="game-grid-host" id="game-grid-host" ${turnTeamAttr} ${gridHostStyle}></section>
    <footer class="game-footer">
      ${canUndo ? `<button type="button" id="undo-move" class="ghost">Undo</button>` : ''}
      <button type="button" id="give-up" class="ghost danger-line">Give up</button>
      ${isOnline ? `<button type="button" id="refresh" class="ghost">↻ Refresh</button>` : ''}
      <button type="button" id="end-game" class="ghost">${isOnline ? 'Leave room' : 'End game'}</button>
    </footer>
  `;

  const host = root.querySelector('#game-grid-host');
  host.appendChild(renderGridSvg(state, grid));

  root.querySelector('#end-game').addEventListener('click', async () => {
    if (isOnline) {
      if (!confirm('Leave the online room?')) return;
      clearAutoPlay();
      await leaveOnlineRoom();
      clearCurrentGame();
      location.hash = '#home';
      return;
    }
    if (confirm('End this game and see the result?')) {
      clearAutoPlay();
      state = { ...state, status: 'ended' };
      saveCurrentGame(state);
      location.hash = '#endgame';
    }
  });

  root.querySelector('#give-up')?.addEventListener('click', async () => {
    const team = currentTeam(state, grid);
    const giverName = onlineActive()
      ? (getSession()?.state?.players?.find(p => p.clientId === getSession().clientId)?.name || 'You')
      : (team ? state.setup.teams[team].name : 'You');
    if (!confirm(`Give up? Current scores stand and the game ends.`)) return;
    clearAutoPlay();
    if (onlineActive()) {
      try { await giveUpOnline(); }
      catch (err) { showToast(err.message || 'Could not give up'); return; }
    } else {
      state = { ...state, status: 'ended', endReason: `${giverName} gave up` };
      saveCurrentGame(state);
      location.hash = '#endgame';
    }
  });

  root.querySelector('#refresh')?.addEventListener('click', async () => {
    const btn = root.querySelector('#refresh');
    btn.disabled = true;
    btn.textContent = '↻ Refreshing…';
    try { await refreshOnline(); } finally { btn.disabled = false; btn.textContent = '↻ Refresh'; }
  });

  const undoBtn = root.querySelector('#undo-move');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      const last = state.moveLog[state.moveLog.length - 1];
      const lastTeamName = state.setup.teams[last.team].name;
      if (confirm(`Undo ${lastTeamName}'s last move? Both teams must agree.`)) {
        clearAutoPlay();
        state = undoLastMove(state);
        saveCurrentGame(state);
        buzz('tap');
        lastRenderKey = null;
        render();
      }
    });
  }

  maybeFireSkipToast();
  scheduleAutoPlayIfOnlyOne();
}

export function mount(target) {
  if (onlineActive()) {
    const session = getSession();
    if (session?.state) {
      state = {
        setup: session.state.setup,
        moveLog: session.state.moveLog,
        status: session.state.status,
      };
      saveCurrentGame(state);
    } else {
      state = getCurrentGame();
    }
  } else {
    state = getCurrentGame();
  }
  if (!state) {
    target.innerHTML = `
      <header class="brand"><h1>No game in progress</h1></header>
      <p class="screen-error"><a href="#setup">Start a new game →</a></p>
    `;
    return;
  }
  grid = deriveGrid(state);
  root = target;
  lastRenderKey = null;
  lastSkipNoticeTurn = -1;
  render();
  maybeShowTutorial();

  if (onlineActive()) {
    unsubOnline = onOnlineUpdate((evt) => {
      if (evt.kind === 'state') {
        const session = getSession();
        if (!session) return;
        state = {
          setup: session.state.setup,
          moveLog: session.state.moveLog,
          status: session.state.status,
        };
        saveCurrentGame(state);
        grid = deriveGrid(state);
        render();
      } else if (evt.kind === 'room-gone') {
        clearAutoPlay();
        alert('Room has ended.');
        clearCurrentGame();
        location.hash = '#home';
      }
    });
  }
}

function maybeShowTutorial() {
  const settings = getSettings();
  if (settings.tutorialSeen) return;
  const overlay = document.createElement('div');
  overlay.className = 'tutorial-overlay';
  overlay.innerHTML = `
    <div class="tutorial-card">
      <h2>How to play</h2>
      <ol class="tutorial-steps">
        <li><strong>Your team's dots</strong> are in alternating columns. Tap the line between two adjacent ones to claim it.</li>
        <li><strong>Block your rival</strong> — a line you draw locks out any opponent line that crosses or overlaps it.</li>
        <li><strong>Win</strong> with the longest single chain (or largest connected tree, depending on setup).</li>
      </ol>
      <button type="button" class="primary" id="tutorial-dismiss">Got it</button>
    </div>
  `;
  root.appendChild(overlay);
  overlay.querySelector('#tutorial-dismiss').addEventListener('click', () => {
    updateSettings({ tutorialSeen: true });
    overlay.remove();
  });
}

export function unmount() {
  clearAutoPlay();
  if (unsubOnline) { unsubOnline(); unsubOnline = null; }
  root = null;
  state = null;
  grid = null;
  lastRenderKey = null;
}

export async function _handleEdgeTap(edgeId) {
  if (onlineActive()) {
    if (!isMyTurn()) {
      flashError('not-your-turn');
      return;
    }
    try {
      buzz('tap');
      playMoveBlip();
      await submitMoveOnline(edgeId);
    } catch (err) {
      flashError(err.code || 'NETWORK', err.message);
    }
    return;
  }
  try {
    state = applyMove(state, edgeId);
    saveCurrentGame(state);
    buzz('tap');
    playMoveBlip();
    lastRenderKey = null;
    render();
  } catch (err) {
    if (err instanceof InvalidMoveError) {
      flashError(err.code);
    } else {
      throw err;
    }
  }
}

function flashError(code, customMsg) {
  const host = root?.querySelector('#game-grid-host');
  if (!host) return;
  host.classList.remove('shake');
  void host.offsetWidth;
  host.classList.add('shake');
  buzz('invalid');
  playInvalidBuzz();
  const msg = customMsg || ({
    [MoveError.WRONG_TEAM]: 'Not your team\'s edge',
    [MoveError.ALREADY_CLAIMED]: 'Already drawn',
    [MoveError.BLOCKED_BY_CROSSING]: 'Blocked — crosses an opponent line',
    [MoveError.UNKNOWN_EDGE]: 'Tap closer to a line',
    [MoveError.GAME_ENDED]: 'Game is already over',
    'not-your-turn': 'Wait for your turn',
    'CONFLICT': 'Opponent moved — refreshing',
    'WRONG_TEAM': 'Not your team\'s turn',
    'INVALID_MOVE': 'Invalid move',
    'NETWORK': 'Connection problem',
  })[code] || 'Invalid move';
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  root.appendChild(toast);
  setTimeout(() => toast.remove(), 1600);
}
