import { currentTeam, applyMove, deriveGrid, InvalidMoveError, MoveError, turnNumberForTeam, undoLastMove } from '../lib/turn-engine.js';
import { scoreFor } from '../lib/scoring.js';
import { getCurrentGame, saveCurrentGame, clearCurrentGame, getSettings, updateSettings } from '../lib/storage.js';
import { renderGridSvg } from './game-render.js';
import { buzz } from '../features/haptic.js';
import { isEnabled } from '../config/features.js';

let state = null;
let grid = null;
let root = null;

function teamMeta(team) {
  return state.setup.teams[team];
}

function bannerHtml() {
  const team = currentTeam(state, grid);
  if (team === null) return `<div class="turn-banner">Game over</div>`;
  const meta = teamMeta(team);
  const turnNum = turnNumberForTeam(state, team);
  return `
    <div class="turn-banner" style="--turn-color:${meta.color}">
      <span class="turn-team">${meta.name}</span>
      <span class="turn-meta">Move #${turnNum} · pass the device</span>
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

function render() {
  if (!root) return;

  if (state.status === 'in-progress' && currentTeam(state, grid) === null) {
    state = { ...state, status: 'ended' };
    saveCurrentGame(state);
  }
  if (state.status === 'ended') {
    location.hash = '#endgame';
    return;
  }

  const winModeLabel = state.setup.winMode === 'tree' ? 'Largest tree' : 'Longest line';
  const canUndo = isEnabled('undoMove') && state.moveLog.length > 0 && state.status === 'in-progress';
  root.innerHTML = `
    <header class="game-header">
      <a href="#home" class="game-back" aria-label="Back to home">← Home</a>
      <span class="game-mode">${winModeLabel}</span>
    </header>
    ${bannerHtml()}
    ${scoreboardHtml()}
    <section class="game-grid-host" id="game-grid-host"></section>
    <footer class="game-footer">
      ${canUndo ? `<button type="button" id="undo-move" class="ghost">Undo last move</button>` : ''}
      <button type="button" id="end-game" class="ghost">End game</button>
    </footer>
  `;

  const host = root.querySelector('#game-grid-host');
  host.appendChild(renderGridSvg(state, grid));

  root.querySelector('#end-game').addEventListener('click', () => {
    if (confirm('End this game and see the result?')) {
      state = { ...state, status: 'ended' };
      saveCurrentGame(state);
      location.hash = '#endgame';
    }
  });

  const undoBtn = root.querySelector('#undo-move');
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      const last = state.moveLog[state.moveLog.length - 1];
      const lastTeamName = state.setup.teams[last.team].name;
      if (confirm(`Undo ${lastTeamName}'s last move? Both teams must agree.`)) {
        state = undoLastMove(state);
        saveCurrentGame(state);
        buzz('tap');
        render();
      }
    });
  }
}

export function mount(target) {
  state = getCurrentGame();
  if (!state) {
    target.innerHTML = `
      <header class="brand"><h1>No game in progress</h1></header>
      <p class="screen-error"><a href="#setup">Start a new game →</a></p>
    `;
    return;
  }
  grid = deriveGrid(state);
  root = target;
  render();
  maybeShowTutorial();
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
  root = null;
  state = null;
  grid = null;
}

export function _handleEdgeTap(edgeId) {
  try {
    state = applyMove(state, edgeId);
    saveCurrentGame(state);
    buzz('tap');
    render();
  } catch (err) {
    if (err instanceof InvalidMoveError) {
      flashError(err.code);
    } else {
      throw err;
    }
  }
}

function flashError(code) {
  const host = root?.querySelector('#game-grid-host');
  if (!host) return;
  host.classList.remove('shake');
  void host.offsetWidth;
  host.classList.add('shake');
  buzz('invalid');
  const msg = ({
    [MoveError.WRONG_TEAM]: 'Not your team\'s edge',
    [MoveError.ALREADY_CLAIMED]: 'Already drawn',
    [MoveError.BLOCKED_BY_CROSSING]: 'Blocked — crosses an opponent line',
    [MoveError.UNKNOWN_EDGE]: 'Tap closer to a line',
    [MoveError.GAME_ENDED]: 'Game is already over',
  })[code] || 'Invalid move';
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  root.appendChild(toast);
  setTimeout(() => toast.remove(), 1600);
}
