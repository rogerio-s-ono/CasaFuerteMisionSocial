/* Service Worker — Manos Fuertes
   Estrategia: app shell (html/js/config/version) = NETWORK-FIRST (con fallback a caché) para
   que las versiones nuevas se vean sin quedar atrapado en caché viejo; assets pesados
   (logos/iconos) = cache-first. skipWaiting + clients.claim → el SW nuevo toma control ya. */
const CACHE = 'cfms-v0.21.1';
const ASSETS = [
  './', './index.html', './app.js', './ui.js', './sync.js', './config.js', './manifest.json',
  './assets/logo-casafuerte-light.png', './assets/logo-mision-heart.png', './assets/logo-mision-social-dark.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(()=>{})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isShell(url){
  return url.pathname.endsWith('/') || url.pathname.endsWith('index.html') ||
         url.pathname.endsWith('app.js') || url.pathname.endsWith('ui.js') ||
         url.pathname.endsWith('sync.js') || url.pathname.endsWith('config.js') ||
         url.pathname.endsWith('version.json') || url.pathname.endsWith('manifest.json');
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // backend: siempre red
  if (url.href.includes('script.google.com')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // app shell: network-first (ve cambios sin quedar en caché viejo)
  if (isShell(url)) {
    e.respondWith(
      fetch(e.request).then((r) => {
        const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy).catch(()=>{}));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // resto (assets): cache-first
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
