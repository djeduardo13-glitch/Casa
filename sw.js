// Service worker: rende l'app installabile e veloce da aprire.
// Strategia "prima la rete": se c'è connessione prende sempre la versione aggiornata,
// altrimenti usa la copia salvata. Le chiamate a Supabase non vengono mai salvate.
const CACHE = 'casa-v5';
const FILE = [
  './', 'index.html', 'styles.css', 'config.js', 'manifest.webmanifest',
  'vendor/preact-htm.js', 'vendor/supabase.js',
  'js/app.js', 'js/tema.js', 'js/backend.js', 'js/crypto.js', 'js/date.js', 'js/ui.js',
  'js/home.js', 'js/agenda.js', 'js/google.js', 'js/gcal.js', 'js/pagamenti.js', 'js/piani.js', 'js/spesa.js', 'js/documenti.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))),
  );
});
