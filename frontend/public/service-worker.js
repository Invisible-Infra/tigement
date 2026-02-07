// Service Worker for Tigement PWA
const CACHE_NAME = 'tigement-v6'
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/resume-recovery.js',
  '/debug-button.js',
  '/manifest.json'
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
  
  // Bypass SW for dev-mode and API - these don't work when cached
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.includes('/.vite/') ||
    url.pathname.startsWith('/api/') ||
    event.request.method !== 'GET'
  ) {
    return
  }
  
  // Network-first for HTML files - always get fresh HTML with correct chunk references
  // When offline: cache-first to avoid long fetch hang on mobile
  if (
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname === '/index.html'
  ) {
    event.respondWith(
      (async () => {
        if (!navigator.onLine) {
          const cached = await caches.match(event.request)
          if (cached) {
            console.log('SW: Serving cached HTML (offline)')
            return cached
          }
          return new Response('Offline and no cached version', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          })
        }
        try {
          const response = await fetch(event.request)
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache))
          return response
        } catch (error) {
          console.error('SW: Network fetch failed for HTML:', error)
          const cached = await caches.match(event.request)
          if (cached) return cached
          return new Response('Offline and no cached version', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          })
        }
      })()
    )
    return
  }
  
  // Network-first for dynamic Vite chunks (production builds)
  // When offline: cache-first to avoid long fetch hang on mobile
  if (
    url.pathname.includes('/assets/') ||       // Vite build assets
    url.pathname.includes('chunk-') ||         // Vite chunk files
    url.search.includes('?v=') ||              // Versioned assets
    url.search.includes('?t=')                 // Timestamped assets
  ) {
    event.respondWith(
      (async () => {
        if (!navigator.onLine) {
          const cached = await caches.match(event.request)
          if (cached) {
            console.log('SW: Serving cached asset (offline):', event.request.url)
            return cached
          }
          return new Response(JSON.stringify({ error: 'Resource unavailable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        let timeoutId
        try {
          const controller = new AbortController()
          timeoutId = setTimeout(() => controller.abort(), 10000)
          const response = await fetch(event.request, { signal: controller.signal })
          clearTimeout(timeoutId)
          if (!response.ok) {
            console.error('SW: Fetch returned non-OK status:', response.status, event.request.url)
          }
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache))
          return response
        } catch (error) {
          if (timeoutId) clearTimeout(timeoutId)
          console.error('SW: Network fetch failed:', error, event.request.url)
          const cached = await caches.match(event.request)
          if (cached) {
            console.log('SW: Serving cached version of:', event.request.url)
            return cached
          }
          return new Response(JSON.stringify({ error: 'Resource unavailable' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      })()
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

