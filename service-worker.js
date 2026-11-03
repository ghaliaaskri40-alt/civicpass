const CACHE_NAME = 'civicpass-shell-v1';
const CORE_ASSETS = [
  './index.html',
  './manifest.webmanifest',
  './images/civicpass-icon.svg',
  './images/civicpass-icon-192.png',
  './images/civicpass-icon-512.png',
  './images/liberty-community.jpg',
  './images/neighborhood-market.jpg',
  './images/new-orleans-jazz.jpg'
];
const CDN_HOSTS = new Set([
  'cdn.tailwindcss.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
]);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('civicpass-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const cacheableCdn = url.protocol === 'https:' && CDN_HOSTS.has(url.hostname);
  if (!sameOrigin && !cacheableCdn) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        return await cache.match(request) || await cache.match(new URL('./index.html', self.registration.scope).href) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (sameOrigin && cached) return cached;
    try {
      const response = await fetch(request);
      if (response && (response.ok || response.type === 'opaque')) {
        try { await cache.put(request, response.clone()); } catch (error) { /* Some cross-origin responses cannot be stored. */ }
      }
      return response;
    } catch (error) {
      return cached || Response.error();
    }
  })());
});
