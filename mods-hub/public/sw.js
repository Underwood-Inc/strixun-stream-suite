/**
 * Service Worker for Mods Hub PWA
 * Handles offline caching and app installation
 */

const CACHE_NAME = 'mods-hub-v1';
const RUNTIME_CACHE = 'mods-hub-runtime-v1';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip non-HTTP(S) requests (chrome-extension://, file://, etc.)
  // These cause "Request scheme 'chrome-extension' is unsupported" errors
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Skip API requests - always use network
  if (event.request.url.includes('/mods-api') || 
      event.request.url.includes('/auth-api') ||
      event.request.url.includes('api.')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response for caching
            const responseToCache = response.clone();

            // Only cache HTTP(S) responses
            if (url.protocol === 'http:' || url.protocol === 'https:') {
              caches.open(RUNTIME_CACHE)
                .then((cache) => {
                  cache.put(event.request, responseToCache).catch((error) => {
                    // Silently ignore cache errors (e.g., for chrome-extension:// URLs)
                    console.debug('[SW] Cache put failed (non-critical):', error);
                  });
                });
            }

            return response;
          })
          .catch(() => {
            // If network fails and we have a cached version, return it
            // Otherwise return a basic offline page
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
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

