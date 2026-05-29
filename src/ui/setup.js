import { createGame } from '../lib/turn-engine.js';
import { SHAPES } from '../lib/geometry.js';
import { saveSetup, getSetup, saveCurrentGame } from '../lib/storage.js';
import { suggestedDifficulty, DIFFICULTY_PRESETS } from '../config/difficulty.js';
import { COLOR_PRESETS, DEFAULT_PRESET } from '../config/color-presets.js';

const DEFAULTS = {
  playerCount: 4,
  teamAName: 'Team Saffron',
  teamAColor: DEFAULT_PRESET.teamA,
  teamBName: 'Team Indigo',
  teamBColor: DEFAULT_PRESET.teamB,
  rows: 4,
  cols: 4,
  winMode: 'line',
  shape: 'rectangle',
};

function loadInitial() {
  const stored = getSetup();
  return { ...DEFAULTS, ...(stored || {}) };
}

export function mount(target) {
  const initial = loadInitial();
  let state = { ...initial };

  target.innerHTML = `
    <header class="brand">
      <h1>Rangoli Royale</h1>
      <p class="tagline">New game</p>
    </header>

    <form id="setup-form" class="setup-form" novalidate>
      <fieldset class="field">
        <legend>Players</legend>
        <div class="player-count">
          ${[2,4,6,8,10,12].map(n => `
            <label class="player-count-option ${state.playerCount === n ? 'is-selected' : ''}">
              <input type="radio" name="playerCount" value="${n}" ${state.playerCount === n ? 'checked' : ''}>
              <span>${n}</span>
            </label>
          `).join('')}
        </div>
        <p class="field-hint" id="player-count-hint"></p>
      </fieldset>

      <fieldset class="field">
        <legend>Color preset</legend>
        <div class="preset-row">
          ${COLOR_PRESETS.map((p, i) => `
            <button type="button" class="preset" data-preset="${i}" title="${p.name}">
              <span class="preset-swatch" style="background:${p.teamA}"></span>
              <span class="preset-swatch" style="background:${p.teamB}"></span>
              <span class="preset-label">${p.name}</span>
            </button>
          `).join('')}
        </div>
      </fieldset>

      <fieldset class="field team-pair">
        <legend>Teams</legend>
        <div class="team-row">
          <label class="team-input">
            <span class="team-label">Team A</span>
            <input type="text" name="teamAName" value="${state.teamAName}" maxlength="24">
            <input type="color" name="teamAColor" value="${state.teamAColor}">
          </label>
          <label class="team-input">
            <span class="team-label">Team B</span>
            <input type="text" name="teamBName" value="${state.teamBName}" maxlength="24">
            <input type="color" name="teamBColor" value="${state.teamBColor}">
          </label>
        </div>
      </fieldset>

      <fieldset class="field">
        <legend>Grid size</legend>
        <div class="grid-presets">
          ${DIFFICULTY_PRESETS.map(d => `
            <button type="button" class="grid-preset ${state.rows === d.rows && state.cols === d.cols ? 'is-selected' : ''}" data-rows="${d.rows}" data-cols="${d.cols}">
              <span class="grid-preset-label">${d.label}</span>
              <span class="grid-preset-meta">${d.rows} × ${d.cols}</span>
            </button>
          `).join('')}
        </div>
      </fieldset>

      <fieldset class="field">
        <legend>Board shape</legend>
        <div class="shape-presets">
          ${SHAPES.map(s => `
            <button type="button" class="shape-preset ${state.shape === s ? 'is-selected' : ''}" data-shape="${s}">
              <span class="shape-preview shape-${s}" aria-hidden="true"></span>
              <span class="shape-label">${s}</span>
            </button>
          `).join('')}
        </div>
      </fieldset>

      <fieldset class="field">
        <legend>Win mode</legend>
        <div class="win-modes">
          <label class="win-mode ${state.winMode === 'line' ? 'is-selected' : ''}">
            <input type="radio" name="winMode" value="line" ${state.winMode === 'line' ? 'checked' : ''}>
            <span class="win-mode-label">Longest line</span>
            <span class="win-mode-meta">Unbroken straight chain wins</span>
          </label>
          <label class="win-mode ${state.winMode === 'tree' ? 'is-selected' : ''}">
            <input type="radio" name="winMode" value="tree" ${state.winMode === 'tree' ? 'checked' : ''}>
            <span class="win-mode-label">Largest tree</span>
            <span class="win-mode-meta">Most dots connected wins</span>
          </label>
        </div>
      </fieldset>

      <div class="setup-actions">
        <a href="#home" class="cancel">Cancel</a>
        <button type="submit" class="primary">Start game</button>
      </div>
    </form>
  `;

  const form = target.querySelector('#setup-form');
  const hint = target.querySelector('#player-count-hint');

  const refreshHint = () => {
    const d = suggestedDifficulty(state.playerCount);
    hint.textContent = `Suggested: ${d.label} (${d.rows}×${d.cols}) for ${state.playerCount} players`;
  };
  refreshHint();

  form.addEventListener('change', (e) => {
    if (e.target.name === 'playerCount') {
      state.playerCount = parseInt(e.target.value, 10);
      target.querySelectorAll('.player-count-option').forEach(el => {
        const v = parseInt(el.querySelector('input').value, 10);
        el.classList.toggle('is-selected', v === state.playerCount);
      });
      refreshHint();
    } else if (e.target.name === 'winMode') {
      state.winMode = e.target.value;
      target.querySelectorAll('.win-mode').forEach(el => {
        el.classList.toggle('is-selected', el.querySelector('input').value === state.winMode);
      });
    } else if (e.target.name === 'teamAName') {
      state.teamAName = e.target.value || DEFAULTS.teamAName;
    } else if (e.target.name === 'teamBName') {
      state.teamBName = e.target.value || DEFAULTS.teamBName;
    } else if (e.target.name === 'teamAColor') {
      state.teamAColor = e.target.value;
    } else if (e.target.name === 'teamBColor') {
      state.teamBColor = e.target.value;
    }
  });

  form.addEventListener('click', (e) => {
    const preset = e.target.closest('.preset');
    if (preset) {
      const p = COLOR_PRESETS[parseInt(preset.dataset.preset, 10)];
      state.teamAColor = p.teamA;
      state.teamBColor = p.teamB;
      form.elements.teamAColor.value = p.teamA;
      form.elements.teamBColor.value = p.teamB;
      return;
    }
    const gridBtn = e.target.closest('.grid-preset');
    if (gridBtn) {
      state.rows = parseInt(gridBtn.dataset.rows, 10);
      state.cols = parseInt(gridBtn.dataset.cols, 10);
      target.querySelectorAll('.grid-preset').forEach(el => {
        el.classList.toggle('is-selected', el === gridBtn);
      });
      return;
    }
    const shapeBtn = e.target.closest('.shape-preset');
    if (shapeBtn) {
      state.shape = shapeBtn.dataset.shape;
      target.querySelectorAll('.shape-preset').forEach(el => {
        el.classList.toggle('is-selected', el === shapeBtn);
      });
      return;
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSetup(state);
    try {
      const game = createGame({
        rows: state.rows,
        cols: state.cols,
        spacing: 40,
        playerCount: state.playerCount,
        winMode: state.winMode,
        shape: state.shape,
        startingTeam: Math.random() < 0.5 ? 'A' : 'B',
        teams: {
          A: { name: state.teamAName, color: state.teamAColor },
          B: { name: state.teamBName, color: state.teamBColor },
        },
      });
      saveCurrentGame(game);
      location.hash = '#game';
    } catch (err) {
      alert(`Could not start: ${err.message}`);
    }
  });
}
