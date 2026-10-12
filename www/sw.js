// Rete per prima (file sempre aggiornati), cache come ripiego offline. Cambia CACHE a ogni rilascio: i vecchi file vengono eliminati.
const CACHE = 'acceleratore-v10';
const SHELL = ['./', 'index.html', 'style.css', 'assets/app.js', 'assets/index.css', 'assets/kreon-latin-400-normal.woff2', 'assets/kreon-latin-700-normal.woff2', 'i18n.js', 'i18n-game.js', 'core.js', 'processes.js', 'physics.js', 'game.js', 'minigame.js', 'budget.js', 'budget-ui.js', 'ui.js', 'svg.js', 'popups.js', 'scene-art.js', 'scene.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
