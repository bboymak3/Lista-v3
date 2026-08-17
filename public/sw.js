// Service Worker para Lista — push notifications + auto-update
// Versión que se actualiza automáticamente — no sirve caché viejo
const CACHE_VERSION = 'lista-v2-' + '20260817' // cambiar al hacer deploy
const STATIC_ASSETS = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  // Skip waiting = el nuevo SW toma control inmediatamente
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
})

self.addEventListener('activate', (event) => {
  // Eliminar TODOS los caches viejos (incluido lista-v1)
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => {
            console.log('[SW] Eliminando cache viejo:', name)
            return caches.delete(name)
          })
      )
    ).then(() => {
      // Tomar control de todos los clientes inmediatamente
      return self.clients.claim()
    }).then(() => {
      // Notificar a los clientes que hay una nueva versión
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'NEW_VERSION', version: CACHE_VERSION })
        })
      })
    })
  )
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

// Fetch — NETWORK FIRST (siempre la versión nueva del servidor)
// Solo usa cache si no hay conexión
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // No interceptar API calls ni archivos de Next.js _next
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) {
    return
  }

  if (event.request.method !== 'GET') return

  // Network first — siempre pedir la versión nueva
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es OK, actualizar el cache
        if (response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone()
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(event.request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        // Si no hay conexión, servir del cache
        return caches.match(event.request).then((cached) => cached || new Response('Offline', { status: 503 }))
      })
  )
})

// Mensaje del cliente para forzar actualización
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
