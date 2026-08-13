import webpush from 'web-push'
import { db } from '@/lib/db'

// Configurar VAPID una sola vez
let vapidConfigured = false

function configureVapid() {
  if (vapidConfigured) return
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@lista.edu'

  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey)
  }
  vapidConfigured = true
}

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; tipo?: string; url?: string }
) {
  configureVapid()

  try {
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId },
    })

    if (subscriptions.length === 0) return

    const payloadString = JSON.stringify(payload)

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dhKey,
                auth: sub.authKey,
              },
            },
            payloadString
          )
        } catch (error: any) {
          // Si el endpoint ya no es válido (410 Gone), eliminar la suscripción
          if (error.statusCode === 410 || error.statusCode === 404) {
            await db.pushSubscription.delete({ where: { id: sub.id } })
          }
        }
      })
    )

    return results
  } catch (error) {
    console.error('Push notification error:', error)
  }
}
