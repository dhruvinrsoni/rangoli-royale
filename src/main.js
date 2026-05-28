const ROUTES = Object.freeze({
  '#home': () => import('./ui/home.js'),
  '#setup': () => import('./ui/setup.js'),
  '#game': () => import('./ui/game.js'),
  '#endgame': () => import('./ui/endgame.js'),
  '#settings': () => import('./ui/settings.js'),
  '#stats': () => import('./ui/stats.js'),
  '#howto': () => import('./ui/howto.js'),
});

const DEFAULT_ROUTE = '#home';
let currentScreen = null;

async function render() {
  const target = document.getElementById('app');
  if (!target) return;

  const route = ROUTES[location.hash] ? location.hash : DEFAULT_ROUTE;
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
    target.innerHTML = `<section class="screen-error"><p>Could not load ${route}. Try refreshing.</p></section>`;
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

window.addEventListener('hashchange', render);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  render();
}
