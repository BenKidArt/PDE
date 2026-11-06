// Service worker: lets the app open fast and work with a weak connection.
// Bump VERSION whenever you publish changes so phones fetch the new files.
const VERSION = 'bb-v16';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/config.js', 'js/i18n.js', 'js/store.js', 'js/store-demo.js', 'js/store-supabase.js',
  'js/shared.js', 'js/photo.js', 'js/ui.js', 'js/champion.js', 'js/vendor/supabase-2.119.0.js',
  'js/views/home.js', 'js/views/battle.js', 'js/views/enter.js', 'js/views/standings.js',
  'js/views/profile.js', 'js/views/terms.js', 'js/views/admin.js', 'js/views/soon.js', 'js/views/tests.js', 'js/views/badges.js',
  'locales/de.json', 'locales/en.json', 'data/battles.json', 'data/badges.json',
  'assets/badges/badge_star.webp', 'assets/badges/badge_heart.webp', 'assets/badges/badge_bulldog.webp',
  'assets/badges/badge_heir_son.webp', 'assets/badges/badge_heir_daughter.webp',
  'content/terms.de.html', 'content/terms.en.html',
  'assets/logo-full.webp', 'assets/partner-cannapot.webp', 'assets/hero-trophy.webp', 'icons/icon-32.png', 'icons/icon-48.png', 'icons/icon-180.png',
  'icons/icon-192.png', 'icons/icon-512.png',
];
// Note: data/prizes.json is deliberately NOT cached up front (members only).

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
