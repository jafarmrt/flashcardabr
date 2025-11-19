// @ts-nocheck
const CACHE_NAME = 'lingua-cards-cache-v1';
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/CHANGELOG.md',
];

const sw = self;

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching App Shell');
        return cache.addAll(APP_SHELL_URLS);
      })
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  // We only want to cache GET requests.
  if (request.method !== 'GET') {
    return;
  }
  
  const url = new URL(request.url);

  // For CDN and font assets, use a Cache-First strategy for performance
  if (url.hostname === 'aistudiocdn.com' || 
      url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com' ||
      url.hostname === 'cdn.tailwindcss.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(request).then(cachedResponse => {
          const fetchPromise = fetch(request).then(networkResponse => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
          // Return cached response if available, otherwise fetch from network.
          return cachedResponse || fetchPromise;
        });
      })
    );
  } else {
    // For all other requests (our app shell), use a Network-First strategy
    // to ensure users get the latest version while providing an offline fallback.
    event.respondWith(
      fetch(request)
        .then(response => {
          // If the request is successful, update the cache.
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(request, responseToCache);
            });
          return response;
        })
        .catch(() => {
          // If the network fails, try to serve from cache.
          // This provides the core offline functionality.
          return caches.match(request);
        })
    );
  }
});