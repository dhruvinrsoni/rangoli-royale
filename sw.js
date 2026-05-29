const CACHE_NAME = 'rangoli-royale-v17';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-192-maskable.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/apple-touch-icon.png',
  './src/main.js',
  './src/lib/events.js',
  './src/lib/geometry.js',
  './src/lib/turn-engine.js',
  './src/lib/scoring.js',
  './src/lib/storage.js',
  './src/lib/preferences.js',
  './src/lib/sync-adapter.js',
  './src/lib/online-session.js',
  './src/config/online.js',
  './src/config/features.js',
  './src/config/difficulty.js',
  './src/config/color-presets.js',
  './src/ui/home.js',
  './src/ui/setup.js',
  './src/ui/game.js',
  './src/ui/game-render.js',
  './src/ui/endgame.js',
  './src/ui/settings.js',
  './src/ui/stats.js',
  './src/ui/howto.js',
  './src/ui/result-card.js',
  './src/ui/room-create.js',
  './src/ui/room-join.js',
  './src/ui/lobby.js',
  './src/features/haptic.js',
  './src/features/turn-timer.js',
  './src/features/sound-fx.js',
  './src/styles/base.css',
  './src/styles/themes.css',
  './src/styles/home.css',
  './src/styles/setup.css',
  './src/styles/game.css',
  './src/styles/endgame.css',
  './src/styles/settings.css',
  './src/styles/stats.css',
  './src/styles/howto.css',
  './src/styles/room.css',
  './docs/rules.md'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request)
        .then(response => {
          if (event.request.method === 'GET' && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
      )
      .catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      })
  );
});
