const CACHE_NAME = 'summer-slam-v1';
const urlsToCache = [
  '/summer-slam/',
  '/summer-slam/index.html',
  '/summer-slam/app.js',
  '/summer-slam/style.css',
  '/summer-slam/manifest.json'
 ];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
