const ROUTES = Object.freeze({
  '#home': () => import('./ui/home.js'),
  '#setup': () => import('./ui/setup.js'),
  '#game': () => import('./ui/game.js'),
  '#endgame': () => import('./ui/endgame.js'),
  '#settings': () => import('./ui/settings.js'),
  '#stats': () => import('./ui/stats.js'),
  '#howto': () => import('./ui/howto.js'),
  '#room-create': () => import('./ui/room-create.js'),
  '#join': () => import('./ui/room-join.js'),
  '#lobby': () => import('./ui/lobby.js'),
});

const DEFAULT_ROUTE = '#home';
let currentScreen = null;

async function render() {
  const target = document.getElementById('app');
  if (!target) return;

  const rawHash = location.hash.split('?')[0] || '';
  const route = ROUTES[rawHash] ? rawHash : DEFAULT_ROUTE;
  const loader = ROUTES[route];

  if (currentScreen?.unmount) {
    try { currentScreen.unmount(target); } catch (err) { console.error('[router] unmount', err); }
  }
  target.innerHTML = '';
  target.dataset.route = route.slice(1);

  try {
    const mod = await loader();
    currentScreen = mod;
    if (typeof mod.mount === 'function') {
      mod.mount(target);
    } else {
      target.innerHTML = `<p>Screen "${route}" has no mount() export.</p>`;
    }
  } catch (err) {
    console.error('[router]', route, err);
    target.innerHTML = `
      <section class="screen-error">
        <h2>Could not load this screen</h2>
        <p class="screen-error-detail">${route}</p>
        <div class="screen-error-actions">
          <button type="button" id="screen-reload" class="primary">Reload</button>
          <a href="#home" class="ghost-link">Home</a>
        </div>
      </section>
    `;
    target.querySelector('#screen-reload')?.addEventListener('click', () => {
      location.reload();
    });
  }
}

export function navigate(hash) {
  if (location.hash === hash) {
    render();
  } else {
    location.hash = hash;
  }
}

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  window.dispatchEvent(new CustomEvent('rr:install-available'));
});

export async function triggerInstall() {
  if (!deferredInstallPrompt) return false;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  return outcome === 'accepted';
}

export const canInstall = () => deferredInstallPrompt !== null;

import { restoreSessionSync } from './lib/online-session.js';

function boot() {
  const restored = restoreSessionSync();
  if (restored?.state) {
    const hash = location.hash || '';
    const isHome = hash === '' || hash === '#home' || hash === '#';
    if (isHome) {
      const status = restored.state.status;
      const target = status === 'lobby' ? '#lobby' : status === 'in-progress' ? '#game' : status === 'ended' ? '#endgame' : null;
      if (target) {
        location.hash = target;
        return;
      }
    }
  }
  render();
}

window.addEventListener('hashchange', render);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
