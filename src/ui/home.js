import { getCurrentGame } from '../lib/storage.js';
import { canInstall, triggerInstall } from '../main.js';
import { checkOnlineAvailable } from '../config/online.js';

let installListener = null;

export async function mount(target) {
  const hasResume = !!getCurrentGame();

  const renderShell = (online) => target.innerHTML = `
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
        <span class="home-btn-label">New Local Game</span>
        <span class="home-btn-meta">One device · pass it around</span>
      </a>
      ${online.available ? `
        <a href="#room-create" class="home-btn home-btn-online">
          <span class="home-btn-label">Create Online Room</span>
          <span class="home-btn-meta">Share a code · play with friends · ${online.active}/${online.max} rooms in use</span>
        </a>
        <a href="#join" class="home-btn home-btn-online">
          <span class="home-btn-label">Join Online Room</span>
          <span class="home-btn-meta">Enter a code you were shared</span>
        </a>` : ''}
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
        <span class="home-btn-meta">Theme · preferences · reset</span>
      </a>
    </nav>

    ${canInstall() ? `
      <button type="button" id="install-btn" class="install-btn">
        <span>Install app</span>
        <span class="install-btn-meta">Add to home screen · play offline</span>
      </button>` : ''}

    <p class="home-footer">v0.3.0 · ${online.available ? 'online' : 'offline'} · <a href="https://github.com/dhruvinrsoni/rangoli-royale" target="_blank" rel="noopener">GitHub</a></p>
  `;

  renderShell({ available: false, max: 0, active: 0 });

  checkOnlineAvailable().then((status) => {
    renderShell(status);
  });

  target.addEventListener('click', async (e) => {
    if (e.target.closest('#install-btn')) {
      const accepted = await triggerInstall();
      if (accepted) renderShell({ available: false, max: 0, active: 0 });
    }
  });

  installListener = () => renderShell({ available: false, max: 0, active: 0 });
  window.addEventListener('rr:install-available', installListener);
}

export function unmount() {
  if (installListener) {
    window.removeEventListener('rr:install-available', installListener);
    installListener = null;
  }
}
