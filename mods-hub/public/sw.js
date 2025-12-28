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
  try {
    const url = new URL(event.request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return; // Skip entirely - don't try to cache or fetch
    }
  } catch (error) {
    // If URL parsing fails, skip this request entirely
    console.debug('[SW] Invalid URL, skipping:', event.request.url);
    return;
  }

  // Skip API requests - always use network
  if (event.request.url.includes('/mods-api') || 
      event.request.url.includes('/auth-api') ||
      event.request.url.includes('api.')) {
    return; // Let browser handle API requests directly
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

            // Only cache HTTP(S) responses - double-check before caching
            try {
              const url = new URL(event.request.url);
              if (url.protocol === 'http:' || url.protocol === 'https:') {
                caches.open(RUNTIME_CACHE)
                  .then((cache) => {
                    // Wrap in try-catch to handle any cache errors gracefully
                    return cache.put(event.request, responseToCache);
                  })
                  .catch((error) => {
                    // Silently ignore cache errors (e.g., for unsupported schemes)
                    // This prevents console errors for chrome-extension:// URLs that slip through
                    console.debug('[SW] Cache put failed (non-critical):', error.message);
                  });
              }
            } catch (error) {
              // If URL parsing fails during caching, just skip caching
              console.debug('[SW] Failed to parse URL for caching:', error.message);
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
      .catch((error) => {
        // If cache match fails, just let the browser handle it
        console.debug('[SW] Cache match failed, letting browser handle request:', error.message);
        return fetch(event.request).catch(() => {
          // If fetch also fails, return offline page for documents
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

