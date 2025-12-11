// Service Worker for Tigement PWA
const CACHE_NAME = 'tigement-v1'
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

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Skip ServiceWorker for:
  // 1. Vite development resources (@vite, @react-refresh, etc.)
  // 2. Requests with timestamp query params (Vite HMR)
  // 3. API calls
  // 4. Non-GET requests
  if (
    url.pathname.startsWith('/@') ||           // Vite special routes (@vite, @react-refresh, etc.)
    url.pathname.startsWith('/src/') ||        // Source files in dev mode
    url.pathname.startsWith('/node_modules/') || // Dependencies in dev mode
    url.search.includes('?t=') ||              // Vite timestamp queries
    url.pathname.startsWith('/api/') ||        // API calls
    event.request.method !== 'GET'             // Non-GET requests
  ) {
    // Bypass cache for development resources and API calls
    event.respondWith(fetch(event.request))
    return
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request)
      })
      .catch((error) => {
        // If cache fails, fetch from network
        console.warn('Cache failed, fetching from network:', error)
        return fetch(event.request)
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

