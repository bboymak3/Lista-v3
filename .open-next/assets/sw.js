// Service Worker para Lista — push notifications + offline
const CACHE_NAME = 'lista-v1'
const STATIC_ASSETS = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

// Push notifications
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = JSON.parse(event.data?.text() || '{}')
  } catch {
    data = { title: 'Lista', body: event.data?.text() || '' }
  }

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tipo || 'general',
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(data.title || 'Lista', options))
})

// Click en notificación → abrir la app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow(event.notification.data.url || '/'))
})

// Fetch — cache first para assets, network first para API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // No interceptar API calls
  if (url.pathname.startsWith('/api/')) return

  // Cache first para assets estáticos
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request)
            .then((response) => {
              if (response.status === 200) {
                const responseClone = response.clone()
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseClone)
                })
              }
              return response
            })
            .catch(() => cached)
        )
      })
    )
  }
})
