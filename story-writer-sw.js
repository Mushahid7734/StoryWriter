/* StoryWriter service worker - GitHub Pages friendly */
const CACHE = 'storywriter-gh-v1';

self.addEventListener('install', (event) => {
  const base = self.registration.scope;
  const ASSETS = [
    base,
    base + 'index.html',
    base + 'story-writer.html',
    base + 'story-writer-manifest.webmanifest',
    base + 'story-writer-icon-192.png',
    base + 'story-writer-icon-512.png',
    'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js',
    'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js'
  ];
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS).catch(function () {}))
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then(function (cached) {
      const network = fetch(req).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
