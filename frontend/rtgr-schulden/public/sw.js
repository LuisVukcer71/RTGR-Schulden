const CACHE_NAME = 'rtgr-schulden-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      // Alte Cache-Versionen aufräumen, falls CACHE_NAME sich mal ändert.
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
    ])
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Erfolgreiche GET-Antworten laufend cachen, damit beim nächsten
        // Offline-Fall tatsächlich etwas im Cache liegt (vorher wurde nie
        // etwas hineingeschrieben - der Offline-Fallback lief immer leer).
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match('/index.html')))
  );
});
