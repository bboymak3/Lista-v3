'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api-client'

export function usePushNotifications() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!user || !token) return

    let subscription: PushSubscription | null = null

    async function setupPush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return
      }

      try {
        // Registrar service worker
        await navigator.serviceWorker.register('/sw.js')
        const reg = await navigator.serviceWorker.ready

        // Verificar si ya hay suscripción
        subscription = await reg.pushManager.getSubscription()

        if (!subscription) {
          // Obtener clave pública VAPID
          const { publicKey } = await api.get<{ publicKey: string }>('/push/subscribe')
          if (!publicKey) return

          // Convertir VAPID key a Uint8Array
          const applicationServerKey = urlBase64ToUint8Array(publicKey)

          // Crear suscripción
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          })
        }

        // Enviar suscripción al servidor (keys en base64)
        const p256dh = arrayBufferToBase64(subscription.getKey('p256dh'))
        const auth = arrayBufferToBase64(subscription.getKey('auth'))

        await api.post('/push/subscribe', {
          endpoint: subscription.endpoint,
          keys: { p256dh, auth },
        })
      } catch (error) {
        // Push permission puede estar denegado — no es crítico
        console.debug('Push setup skipped:', error)
      }
    }

    setupPush()
  }, [user, token])
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  return btoa(binary)
}
