// Service worker: lets the app open fast and work with a weak connection.
// Bump VERSION whenever you publish changes so phones fetch the new files.
const VERSION = 'bb-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/i18n.js', 'js/store.js', 'js/photo.js', 'js/ui.js',
  'js/views/battle.js', 'js/views/enter.js',
  'locales/de.json', 'locales/en.json', 'data/battles.json',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'assets/partner-logo.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first (always fresh content), fall back to the saved copy when offline.
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })),
  );
});
