import { getCurrentGame } from '../lib/storage.js';
import { canInstall, triggerInstall } from '../main.js';

let installListener = null;

export function mount(target) {
  const hasResume = !!getCurrentGame();

  const renderShell = () => target.innerHTML = `
    <header class="brand">
      <h1>Rangoli Royale</h1>
      <p class="tagline">Draw the line. Hold the grid.</p>
    </header>

    <nav class="home-nav" aria-label="Main menu">
      ${hasResume ? `
        <a href="#game" class="home-btn primary" data-action="resume">
          <span class="home-btn-label">Resume Game</span>
          <span class="home-btn-meta">Continue your last match</span>
        </a>` : ''}
      <a href="#setup" class="home-btn ${hasResume ? '' : 'primary'}">
        <span class="home-btn-label">New Game</span>
        <span class="home-btn-meta">Pick teams, pick a grid, start</span>
      </a>
      <a href="#howto" class="home-btn">
        <span class="home-btn-label">How to Play</span>
        <span class="home-btn-meta">Rules + blocking mechanic</span>
      </a>
      <a href="#stats" class="home-btn">
        <span class="home-btn-label">Stats</span>
        <span class="home-btn-meta">Past games · win counts</span>
      </a>
      <a href="#settings" class="home-btn">
        <span class="home-btn-label">Settings</span>
        <span class="home-btn-meta">Theme · reset · import/export</span>
      </a>
    </nav>

    ${canInstall() ? `
      <button type="button" id="install-btn" class="install-btn">
        <span>Install app</span>
        <span class="install-btn-meta">Add to home screen · play offline</span>
      </button>` : ''}

    <p class="home-footer">v0.1.6 · <a href="https://github.com/dhruvinrsoni/rangoli-royale" target="_blank" rel="noopener">GitHub</a></p>
  `;

  renderShell();

  target.addEventListener('click', async (e) => {
    if (e.target.closest('#install-btn')) {
      const accepted = await triggerInstall();
      if (accepted) renderShell();
    }
  });

  installListener = () => renderShell();
  window.addEventListener('rr:install-available', installListener);
}

export function unmount() {
  if (installListener) {
    window.removeEventListener('rr:install-available', installListener);
    installListener = null;
  }
}
