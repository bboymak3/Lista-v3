// Implementación ligera de Web Push usando Web Crypto API
// Sin dependencias externas (reemplaza librería web-push de ~3MiB)

interface PushSubscriptionData {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

function base64urlToBytes(str: string): Uint8Array {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4)
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function strToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

async function hmacSign(key: ArrayBuffer, data: ArrayBuffer): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  return crypto.subtle.sign('HMAC', cryptoKey, data)
}

async function importVapidPrivateKey(privateKeyB64: string): Promise<CryptoKey> {
  const keyBytes = base64urlToBytes(privateKeyB64)
  return crypto.subtle.importKey(
    'raw', keyBytes, { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  )
}

async function createVapidJwt(privateKey: CryptoKey, audience: string, subject: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: subject,
  }
  const enc = (o: object) => btoa(JSON.stringify(o)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const data = `${enc(header)}.${enc(payload)}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    strToBytes(data)
  )
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${data}.${sigB64}`
}

function getAudience(endpoint: string): string {
  try {
    const url = new URL(endpoint)
    return `${url.protocol}//${url.host}`
  } catch {
    return 'https://fcm.googleapis.com'
  }
}

async function encryptPayload(
  payload: string,
  subscription: PushSubscriptionData
): Promise<ArrayBuffer> {
  const p256dhKey = base64urlToBytes(subscription.keys.p256dh)
  const authSecret = base64urlToBytes(subscription.keys.auth)

  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw', p256dhKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )

  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  )

  const ikm = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberPublicKey },
    ephemeralKeyPair.privateKey,
    256
  )

  const ephemeralPublicKeyBytes = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey)

  const prk = await hmacSign(authSecret.buffer as ArrayBuffer, ikm)
  const cekInfo = strToBytes('Content-Encoding: aes128gcm\0\0\x01')
  const cekFull = await hmacSign(prk, cekInfo.buffer as ArrayBuffer)
  const cek = cekFull.slice(0, 16)

  const nonceInfo = strToBytes('Content-Encoding: nonce\0\0\x01')
  const nonceFull = await hmacSign(prk, nonceInfo.buffer as ArrayBuffer)
  const nonce = nonceFull.slice(0, 12)

  const paddedPayload = new Uint8Array(payload.length + 2)
  paddedPayload.set(strToBytes(payload), 0)
  paddedPayload[payload.length] = 2

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: new Uint8Array(0) },
    await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']),
    paddedPayload
  )

  const header = new Uint8Array(21 + ephemeralPublicKeyBytes.byteLength)
  header[0] = 0
  header[1] = 0
  header[2] = 16
  header[3] = 0
  header[4] = 0x10
  header.set(new Uint8Array(ephemeralPublicKeyBytes), 5)

  const result = new Uint8Array(header.length + encrypted.byteLength)
  result.set(header, 0)
  result.set(new Uint8Array(encrypted), header.length)
  return result.buffer
}

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; tipo?: string; url?: string }
): Promise<void> {
  try {
    const { db } = await import('@/lib/db')
    const subscriptions = await db.pushSubscription.findMany({ where: { userId } })
    if (subscriptions.length === 0) return

    const privateKey = process.env.VAPID_PRIVATE_KEY
    const publicKey = process.env.VAPID_PUBLIC_KEY
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@lista.edu'
    if (!privateKey || !publicKey) {
      console.warn('VAPID keys no configuradas')
      return
    }

    const vapidKey = await importVapidPrivateKey(privateKey)
    const payloadStr = JSON.stringify(payload)

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const audience = getAudience(sub.endpoint)
          const jwt = await createVapidJwt(vapidKey, audience, subject)
          const encrypted = await encryptPayload(payloadStr, {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
          })

          const res = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Encoding': 'aes128gcm',
              'TTL': '2419200',
              'Authorization': `vapid t=${jwt}, k=${publicKey}`,
            },
            body: encrypted,
          })

          if (res.status === 410 || res.status === 404) {
            await db.pushSubscription.delete({ where: { id: sub.id } })
          }
        } catch (err) {
          console.error('Push send error:', err)
        }
      })
    )
  } catch (error) {
    console.error('Push notification error:', error)
  }
}
