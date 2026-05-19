const CACHE_NAME = 'summer-slam-v10';

self.addEventListener('install', e => {
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

  e.respondWith(
    fetch(e.request).then(res => {
      if (e.request.method === 'GET' && res.ok) {
        const clone = res.clone(); // clone synchronously before any async work
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }
      // Non-ok (e.g. 500): serve cached version if available, otherwise pass through
      return caches.match(e.request).then(cached => cached ?? res);
    }).catch(() => caches.match(e.request).then(cached => cached ?? caches.match('/')))
  );
});
