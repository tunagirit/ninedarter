// ninedarter service worker — network-first app shell (always revalidated), offline fallback, runtime cache for fonts.
const VERSION = 'nd-v1.0.8c';
const FONTS = 'nd-fonts';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css', './icons/icon.svg',
  './vendor/preact-htm.js', './js/main.js', './js/store.js', './js/i18n.js', './js/ui.js', './js/voice.js', './js/darts.js', './js/bot.js', './js/match.js',
  './js/engines/x01.js', './js/engines/cricket.js', './js/engines/training.js',
  './js/screens/home.js', './js/screens/setup.js', './js/screens/game.js', './js/screens/results.js', './js/screens/stats.js', './js/screens/players.js', './js/screens/settings.js', './js/screens/common.js', './js/screens/statstable.js', './js/screens/profile.js', './js/cloud.js', './js/config.js', './js/teams.js', './js/screens/social.js', './js/screens/starter.js', './vendor/supabase.js', './icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the browser's HTTP cache so a new version never stores stale files
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Fonts: stale-while-revalidate
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(caches.open(FONTS).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // App shell: network first and always revalidated with the server (cache: 'no-cache'),
  // so a new deploy shows up on the next load; the cached copy is only used offline.
  // A transient server error (e.g. 503 from the CDN) is retried once, then the cached copy is used.
  e.respondWith((async () => {
    try {
      let r = await fetch(req, { cache: 'no-cache' });
      if (r.status >= 500) r = await fetch(req, { cache: 'no-cache' }).catch(() => r);
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return r; }
      return (await caches.match(req)) || r;
    } catch {
      return (await caches.match(req)) || (await caches.match('./index.html')) || Response.error();
    }
  })());
});
