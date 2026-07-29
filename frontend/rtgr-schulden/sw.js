self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Einfacher Fetch-Handler, damit die PWA-Kriterien erfüllt sind
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});