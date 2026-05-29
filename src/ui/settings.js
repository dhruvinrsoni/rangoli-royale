import { getSettings, updateSettings, clearCurrentGame, clearHistory, fullReset, exportAll, importAll } from '../lib/storage.js';
import { getPref, setPref } from '../lib/preferences.js';
import { isEnabled } from '../config/features.js';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

export function mount(target) {
  const settings = getSettings();
  const theme = settings.theme || 'auto';
  applyTheme(theme);

  target.innerHTML = `
    <header class="brand">
      <h1>Settings</h1>
      <p class="tagline">All data stays on this device.</p>
    </header>

    <section class="settings-section">
      <h2>Theme</h2>
      <div class="theme-row">
        ${['auto','light','dark'].map(t => `
          <button type="button" class="theme-btn ${theme === t ? 'is-selected' : ''}" data-theme="${t}">${t}</button>
        `).join('')}
      </div>
    </section>

    <section class="settings-section">
      <h2>Preferences</h2>
      <div class="pref-list">
        ${isEnabled('hapticFeedback') ? `
          <label class="pref-row">
            <span class="pref-label">
              <span class="pref-name">Haptic feedback</span>
              <span class="pref-meta">Short buzz on every move</span>
            </span>
            <input type="checkbox" data-pref="haptic" ${getPref('haptic') ? 'checked' : ''}>
          </label>` : ''}
        ${isEnabled('soundFx') ? `
          <label class="pref-row">
            <span class="pref-label">
              <span class="pref-name">Sound effects</span>
              <span class="pref-meta">Tone on each move + invalid buzz</span>
            </span>
            <input type="checkbox" data-pref="soundFx" ${getPref('soundFx') ? 'checked' : ''}>
          </label>` : ''}
      </div>
    </section>

    <section class="settings-section">
      <h2>Reset</h2>
      <button type="button" id="reset-current" class="danger-line">Discard current game</button>
      <button type="button" id="reset-history" class="danger-line">Clear game history</button>
      <button type="button" id="reset-all" class="danger">Wipe everything</button>
    </section>

    <section class="settings-section">
      <h2>Backup</h2>
      <button type="button" id="export">Export to file</button>
      <label class="import-label">
        Import from file
        <input type="file" id="import" accept="application/json" hidden>
      </label>
    </section>

    <a href="#home" class="settings-back">← Home</a>
  `;

  target.querySelectorAll('input[data-pref]').forEach(input => {
    input.addEventListener('change', () => {
      setPref(input.dataset.pref, input.checked);
    });
  });

  target.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.theme;
      updateSettings({ theme: t });
      applyTheme(t);
      target.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('is-selected', b === btn));
    });
  });

  target.querySelector('#reset-current').addEventListener('click', () => {
    if (confirm('Discard the in-progress game?')) {
      clearCurrentGame();
      alert('Current game cleared.');
    }
  });

  target.querySelector('#reset-history').addEventListener('click', () => {
    if (confirm('Clear all past game history? This cannot be undone.')) {
      clearHistory();
      alert('History cleared.');
    }
  });

  target.querySelector('#reset-all').addEventListener('click', () => {
    if (confirm('Wipe ALL Rangoli Royale data — setup, current game, history, settings. Are you sure?')) {
      fullReset();
      applyTheme('auto');
      location.hash = '#home';
      location.reload();
    }
  });

  target.querySelector('#export').addEventListener('click', () => {
    const payload = exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rangoli-royale-backup-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  target.querySelector('#import').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      importAll(payload);
      alert('Import complete.');
      location.reload();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
  });
}
