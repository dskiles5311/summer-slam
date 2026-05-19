const CACHE_NAME = 'summer-slam-v9';

self.addEventListener('install', e => {
  // Pre-cache the app shell so the UI loads even on first visit with no network
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(['/', '/index.html']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;

  // Network-first: try network, cache successful GET responses, fall back to cache offline
  e.respondWith(
    fetch(e.request).then(res => {
      if (e.request.method === 'GET' && res.ok) {
        caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
      }
      return res;
    }).catch(() => caches.match(e.request).then(cached => cached || caches.match('/')))
  );
});
