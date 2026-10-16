/* StoryWriter service worker - offline-capable, HTML network-first (v12)
   Bump CACHE when shipping app-shell changes so clients drop old caches. */
const CACHE = 'storywriter-offline-v19';
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
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
          return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isHtmlRequest(req, url) {
  if (req.mode === 'navigate') return true;
  var accept = req.headers.get('accept') || '';
  if (accept.indexOf('text/html') !== -1) return true;
  var p = url.pathname || '';
  return (
    p.endsWith('/') ||
    p.endsWith('/index.html') ||
    p.endsWith('/story-writer.html') ||
    p.endsWith('/storywriter.html') ||
    /\.html?$/i.test(p)
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  // Always fetch SW script from network
  if (url.origin === self.location.origin && url.pathname.indexOf('story-writer-sw.js') !== -1) {
    event.respondWith(fetch(req));
    return;
  }

  // App HTML: network first so new tools ship; fall back to cache offline
  if (url.origin === self.location.origin && isHtmlRequest(req, url)) {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) {
              c.put(req, copy);
              // Also store under common shell keys
              try {
                c.put('./index.html', res.clone());
              } catch (e) {}
            });
          }
          return res;
        })
        .catch(function () {
          return caches.match(req).then(function (cached) {
            return (
              cached ||
              caches.match('./index.html') ||
              caches.match('./') ||
              caches.match('./storywriter.html') ||
              caches.match('./story-writer.html')
            );
          });
        })
    );
    return;
  }

  // Icons + manifest: stale-while-revalidate
  if (
    url.origin === self.location.origin &&
    (url.pathname.endsWith('.webmanifest') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.ico'))
  ) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var fetched = fetch(req)
          .then(function (res) {
            if (res && res.ok) {
              var copy = res.clone();
              caches.open(CACHE).then(function (c) {
                c.put(req, copy);
              });
            }
            return res;
          })
          .catch(function () {
            return cached;
          });
        return cached || fetched;
      })
    );
    return;
  }

  // CDN libs / fonts: cache first
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
            var copy = res.clone();
            caches.open(CACHE).then(function (c) {
              c.put(req, copy);
            });
          }
          return res;
        });
      })
    );
    return;
  }

  // Datamuse dictionary — network, empty JSON offline
  if (url.hostname.indexOf('datamuse.com') !== -1) {
    event.respondWith(
      fetch(req).catch(function () {
        return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  // LanguageTool — network only
  if (url.hostname.indexOf('api.languagetool.org') !== -1) {
    event.respondWith(fetch(req));
    return;
  }

  // Default: network, cache on success, fall back to cache
  event.respondWith(
    fetch(req)
      .then(function (res) {
        if (res && res.ok && url.origin === self.location.origin) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) {
            c.put(req, copy);
          });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req);
      })
  );
});
