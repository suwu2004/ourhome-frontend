const CACHE_PREFIX = 'ourhome-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const CORE_SHELL = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

function sameOrigin(url) {
  try {
    return new URL(url, self.location.origin).origin === self.location.origin;
  } catch {
    return false;
  }
}

function staticAssetPath(pathname) {
  return pathname.startsWith('/assets/')
    || pathname === '/manifest.json'
    || pathname === '/icon-192.png'
    || pathname === '/icon-512.png'
    || pathname === '/apple-touch-icon.png';
}

async function cacheBuiltAssets(cache) {
  try {
    const response = await fetch('/', { cache: 'no-store' });
    if (!response.ok) return;
    await cache.put('/', response.clone());
    const html = await response.text();
    const urls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map(match => match[1])
      .filter(url => sameOrigin(url))
      .map(url => new URL(url, self.location.origin).pathname)
      .filter(pathname => staticAssetPath(pathname));
    await Promise.all([...new Set(urls)].map(async pathname => {
      try {
        const asset = await fetch(pathname, { cache: 'no-store' });
        if (asset.ok) await cache.put(pathname, asset);
      } catch {
        // Runtime caching will fill anything that was not available during install.
      }
    }));
  } catch {
    // A failed install prefetch must not stop an already cached OurHome from working.
  }
}

async function pruneOldBuiltAssets(cache) {
  try {
    const response = await fetch('/', { cache: 'no-store' });
    if (!response.ok) return;
    const html = await response.clone().text();
    const livePaths = new Set(CORE_SHELL);
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const value = match[1];
      if (!sameOrigin(value)) continue;
      const pathname = new URL(value, self.location.origin).pathname;
      if (staticAssetPath(pathname)) livePaths.add(pathname);
    }
    const requests = await cache.keys();
    await Promise.all(requests.map(request => {
      const pathname = new URL(request.url).pathname;
      return pathname.startsWith('/assets/') && !livePaths.has(pathname)
        ? cache.delete(request)
        : undefined;
    }));
  } catch {
    // Cleanup is best-effort; the existing offline shell remains usable.
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(CORE_SHELL.map(async url => {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) await cache.put(url, response);
      } catch {
        // Keep installing even when one optional icon cannot be fetched.
      }
    }));
    await cacheBuiltAssets(cache);
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await pruneOldBuiltAssets(await caches.open(CACHE_NAME));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API responses, auth state, chat data or private cloud reads.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/', response.clone());
        }
        return response;
      } catch {
        return (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  if (!staticAssetPath(url.pathname)) return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return cached || Response.error();
    }
  })());
});
