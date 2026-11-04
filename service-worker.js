const CACHE_NAME = 'civicpass-shell-v5';
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
const EXTERNAL_ASSETS = [
  { url: 'https://cdn.tailwindcss.com', mode: 'no-cors' },
  { url: 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js', mode: 'cors' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', mode: 'cors' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2', mode: 'cors' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2', mode: 'cors' },
  { url: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap', mode: 'cors' }
];

async function cacheExternalAsset(cache, asset) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const request = new Request(asset.url, { mode: asset.mode });
    const response = await fetch(request, { signal: controller.signal });
    if (response && (response.ok || response.type === 'opaque')) await cache.put(request, response.clone());
  } catch (error) {
    // The app shell still installs if a CDN is temporarily unavailable.
  } finally {
    clearTimeout(timeout);
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await Promise.allSettled(EXTERNAL_ASSETS.map(asset => cacheExternalAsset(cache, asset)));
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

