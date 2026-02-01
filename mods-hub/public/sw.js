/**
 * Service Worker for Mods Hub PWA
 * Handles offline caching and app installation
 * 
 * CACHE INVALIDATION STRATEGY:
 * - Hashed assets (JS/CSS with content hashes): Network-first with cache fallback
 * - Static assets (images, fonts, manifest): Cache-first with network fallback
 * - HTML/navigation: Network-first to always get latest app shell
 * 
 * This prevents stale JS/CSS from breaking the app after deployments.
 */

// IMPORTANT: Increment this version on each deployment to force cache invalidation
// Build tools should inject this, or manually update on deploy
const SW_VERSION = '2';
const CACHE_NAME = `mods-hub-cache-v${SW_VERSION}`;
const RUNTIME_CACHE = `mods-hub-runtime-v${SW_VERSION}`;

// Only cache truly static assets on install (not hashed JS/CSS)
const PRECACHE_ASSETS = [
  '/manifest.json',
];

// Patterns for hashed assets that should use network-first strategy
const HASHED_ASSET_PATTERN = /\.(js|css)(\?.*)?$/i;
const CONTAINS_HASH_PATTERN = /[-_.][a-f0-9]{8,}\.(js|css)$/i;

// Install event - cache static assets only
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing service worker v${SW_VERSION}...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Skipping waiting to activate immediately');
        return self.skipWaiting();
      })
  );
});

// Activate event - AGGRESSIVELY clean up ALL old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating service worker v${SW_VERSION}...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Delete ANY cache that doesn't match current version
            const isOldCache = cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
            if (isOldCache) {
              console.log('[SW] Deleting old cache:', cacheName);
            }
            return isOldCache;
          })
          .map((cacheName) => caches.delete(cacheName))
      );
    })
    .then(() => {
      console.log('[SW] Claiming all clients');
      return self.clients.claim();
    })
    .then(() => {
      // Notify all clients to refresh (optional but helpful)
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: SW_VERSION });
        });
      });
    })
  );
});

/**
 * Determine the caching strategy for a request
 * @param {URL} url - The request URL
 * @param {Request} request - The request object
 * @returns {'network-first' | 'cache-first' | 'network-only'} The strategy to use
 */
function getCacheStrategy(url, request) {
  const pathname = url.pathname.toLowerCase();
  
  // Network-only: API requests, external resources
  if (url.origin !== self.location.origin) {
    return 'network-only';
  }
  
  // Network-first: HTML documents (always get fresh app shell)
  if (request.destination === 'document' || pathname.endsWith('.html') || pathname === '/') {
    return 'network-first';
  }
  
  // Network-first: Hashed JS/CSS files (Vite build outputs like index-BdL5vxp2.js)
  // These MUST be network-first because the hash changes on each build
  if (CONTAINS_HASH_PATTERN.test(pathname)) {
    return 'network-first';
  }
  
  // Network-first: Any JS/CSS file (safer default)
  if (HASHED_ASSET_PATTERN.test(pathname)) {
    return 'network-first';
  }
  
  // Cache-first: Static assets (images, fonts, manifest)
  if (pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot|json)$/i)) {
    return 'cache-first';
  }
  
  // Default: network-first for safety
  return 'network-first';
}

/**
 * Network-first strategy: Try network, fall back to cache
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    // Only cache successful responses
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.debug('[SW] Network failed, serving from cache:', request.url);
      return cachedResponse;
    }
    
    // For documents, return cached index.html for offline support
    if (request.destination === 'document') {
      const offlinePage = await caches.match('/index.html');
      if (offlinePage) {
        return offlinePage;
      }
    }
    
    // Nothing in cache, return error
    return new Response('Network error', { 
      status: 503, 
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/**
 * Cache-first strategy: Try cache, fall back to network
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    
    return response;
  } catch (error) {
    return new Response('Resource not available', { 
      status: 503, 
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Fetch event - use appropriate strategy based on request type
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip non-HTTP(S) requests (chrome-extension://, file://, etc.)
  let url;
  try {
    url = new URL(event.request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return;
    }
  } catch {
    console.debug('[SW] Invalid URL, skipping:', event.request.url);
    return;
  }

  // Skip API image requests - let browser handle directly
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  if ((hostname.includes('mods-api.idling.app') || hostname.includes('api.idling.app')) &&
      (pathname.includes('/badge') || pathname.includes('/thumbnail') || pathname.includes('/og-image'))) {
    return;
  }

  const strategy = getCacheStrategy(url, event.request);
  
  if (strategy === 'network-only') {
    // Don't intercept, let browser handle
    return;
  }
  
  if (strategy === 'network-first') {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  if (strategy === 'cache-first') {
    event.respondWith(cacheFirst(event.request));
    return;
  }
});

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);
  // Future: Handle push notifications for mod updates, reviews, etc.
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();
  // Future: Navigate to relevant page
  event.waitUntil(
    clients.openWindow('/')
  );
});

