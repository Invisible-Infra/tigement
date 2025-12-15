// Service Worker for Tigement PWA
const CACHE_NAME = 'tigement-v3'
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.svg'
]

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache)
      })
      .catch((error) => {
        console.error('ServiceWorker install failed:', error)
      })
  )
  // Force the waiting service worker to become the active service worker
  self.skipWaiting()
})

// Fetch event - network-first for dynamic assets, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Always bypass ServiceWorker for:
  if (
    url.pathname.startsWith('/@') ||           // Vite special routes
    url.pathname.startsWith('/src/') ||        // Source files in dev
    url.pathname.startsWith('/node_modules/') || // Vite dependencies
    url.pathname.startsWith('/api/') ||        // API calls
    event.request.method !== 'GET'             // Non-GET requests
  ) {
    event.respondWith(fetch(event.request))
    return
  }
  
  // Network-first for dynamic Vite chunks (production builds)
  if (
    url.pathname.includes('/assets/') ||       // Vite build assets
    url.pathname.includes('chunk-') ||         // Vite chunk files
    url.search.includes('?v=') ||              // Versioned assets
    url.search.includes('?t=')                 // Timestamped assets
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (!response.ok) {
            console.error('SW: Fetch returned non-OK status:', response.status, event.request.url)
            // Still try to cache it for offline use
          }
          // Cache the new version
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
          return response
        })
        .catch((error) => {
          console.error('SW: Network fetch failed:', error, event.request.url)
          // Try cache fallback
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse
            }
            // If critical resource fails, return error that won't break the page
            console.error('SW: No cache available for:', event.request.url)
            return new Response(
              JSON.stringify({ error: 'Resource unavailable' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            )
          })
        })
    )
    return
  }
  
  // Cache-first for static resources
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request)
      })
      .catch((error) => {
        console.warn('Cache and network both failed:', error)
        return new Response('Network error', { status: 408 })
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim()
    })
  )
})

