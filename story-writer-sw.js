/* StoryWriter service worker - offline-first */
const CACHE = 'storywriter-offline-v3';
const PRECACHE = [
  './',
  './index.html',
  './story-writer.html',
  './storywriter.html',
  './story-writer-manifest.webmanifest',
  './story-writer-icon-192.png',
  './story-writer-icon-512.png',
  'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js'
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(function () {})))
    ).then(function () {
      return self.skipWaiting();
    })
  );
});
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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
  const url = new URL(req.url);
  const isAppShell =
    url.origin === self.location.origin &&
    (url.pathname.endsWith('/') ||
      url.pathname.endsWith('/index.html') ||
      url.pathname.endsWith('/story-writer.html') ||
      url.pathname.endsWith('/storywriter.html') ||
      url.pathname.endsWith('.webmanifest') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('story-writer-sw.js'));
  if (isAppShell) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        const fetched = fetch(req).then(function (res) {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        }).catch(function () {
          return cached || caches.match('./index.html') || caches.match('./storywriter.html');
        });
        return cached || fetched;
      })
    );
    return;
  }
  if (
    url.hostname.indexOf('cdn.jsdelivr.net') !== -1 ||
    url.hostname.indexOf('cdnjs.cloudflare.com') !== -1 ||
    url.hostname.indexOf('fonts.googleapis.com') !== -1 ||
    url.hostname.indexOf('fonts.gstatic.com') !== -1
  ) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        });
      })
    );
    return;
  }
  if (url.hostname.indexOf('datamuse.com') !== -1) {
    event.respondWith(fetch(req).catch(function () {
      return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    }));
    return;
  }
  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && url.origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req);
    })
  );
});
