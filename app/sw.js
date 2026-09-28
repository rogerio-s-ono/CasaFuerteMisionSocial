/* Service Worker — Casa Fuerte Misión Social
   Regra (lição gideao300): version.json SEMPRE da rede; app shell cache-first. */
const CACHE = 'cfms-v0.4.1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './ui.js',
  './config.js',
  './manifest.json',
  './assets/logo-casafuerte-light.png',
  './assets/logo-mision-heart.png',
  './assets/logo-mision-social-dark.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // version.json e chamadas ao backend: sempre rede (nunca cache)
  if (url.pathname.endsWith('version.json') || url.href.includes('script.google.com')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // app shell: cache-first
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
