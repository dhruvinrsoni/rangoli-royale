import { SHAPES } from '../lib/geometry.js';
import { DIFFICULTY_PRESETS } from '../config/difficulty.js';
import { COLOR_PRESETS, DEFAULT_PRESET } from '../config/color-presets.js';
import { createRoom, getRememberedName } from '../lib/online-session.js';

const DEFAULTS = {
  playerCount: 4,
  hostName: '',
  teamAName: 'Team Saffron',
  teamAColor: DEFAULT_PRESET.teamA,
  teamBName: 'Team Indigo',
  teamBColor: DEFAULT_PRESET.teamB,
  rows: 4,
  cols: 4,
  winMode: 'line',
  shape: 'rectangle',
};

export function mount(target) {
  let state = { ...DEFAULTS };
  target.innerHTML = `
    <header class="brand">
      <h1>Create online room</h1>
      <p class="tagline">Share the code · friends join · play together</p>
    </header>

    <form id="room-form" class="setup-form" novalidate>
      <fieldset class="field">
        <legend>Your name</legend>
        <input type="text" name="hostName" placeholder="Your nickname" maxlength="20" class="text-input" value="${getRememberedName()}" required>
      </fieldset>

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
        <button type="submit" class="primary">Create room</button>
      </div>
      <p class="form-error" id="form-error" hidden></p>
    </form>
  `;

  const form = target.querySelector('#room-form');
  const errEl = target.querySelector('#form-error');

  const showError = (msg) => {
    errEl.textContent = msg;
    errEl.hidden = !msg;
  };

  form.addEventListener('change', (e) => {
    if (e.target.name === 'playerCount') {
      state.playerCount = parseInt(e.target.value, 10);
      target.querySelectorAll('.player-count-option').forEach(el => {
        const v = parseInt(el.querySelector('input').value, 10);
        el.classList.toggle('is-selected', v === state.playerCount);
      });
    } else if (e.target.name === 'winMode') {
      state.winMode = e.target.value;
      target.querySelectorAll('.win-mode').forEach(el => {
        el.classList.toggle('is-selected', el.querySelector('input').value === state.winMode);
      });
    } else if (e.target.name === 'hostName') {
      state.hostName = e.target.value;
    }
  });

  form.addEventListener('click', (e) => {
    const preset = e.target.closest('.preset');
    if (preset) {
      const p = COLOR_PRESETS[parseInt(preset.dataset.preset, 10)];
      state.teamAColor = p.teamA;
      state.teamBColor = p.teamB;
      return;
    }
    const gridBtn = e.target.closest('.grid-preset');
    if (gridBtn) {
      state.rows = parseInt(gridBtn.dataset.rows, 10);
      state.cols = parseInt(gridBtn.dataset.cols, 10);
      target.querySelectorAll('.grid-preset').forEach(el => el.classList.toggle('is-selected', el === gridBtn));
      return;
    }
    const shapeBtn = e.target.closest('.shape-preset');
    if (shapeBtn) {
      state.shape = shapeBtn.dataset.shape;
      target.querySelectorAll('.shape-preset').forEach(el => el.classList.toggle('is-selected', el === shapeBtn));
      return;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const hostName = form.elements.hostName.value.trim() || 'Host';
    state.hostName = hostName;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating…';
    try {
      const setup = {
        rows: state.rows,
        cols: state.cols,
        spacing: 40,
        playerCount: state.playerCount,
        winMode: state.winMode,
        shape: state.shape,
        teams: {
          A: { name: state.teamAName, color: state.teamAColor },
          B: { name: state.teamBName, color: state.teamBColor },
        },
      };
      await createRoom(setup, hostName);
      location.hash = '#lobby';
    } catch (err) {
      if (err.code === 'CAPACITY') {
        showError(`All rooms are full right now. Try again in a few minutes, or play locally → `);
        const a = document.createElement('a');
        a.href = '#setup';
        a.textContent = 'Start local game';
        a.style.color = 'var(--rr-accent)';
        errEl.appendChild(a);
      } else {
        showError(err.message || 'Could not create the room');
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create room';
    }
  });
}
