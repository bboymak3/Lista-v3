import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

// GET /api/push/vapid-public — devuelve la clave pública VAPID
export async function GET(request: NextRequest) {
  return NextResponse.json({
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
  })
}

// POST /api/push/subscribe — registra una suscripción de push
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { endpoint, keys } = body

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })
    }

    if (isD1()) {
      // Producción: D1 — Upsert: si ya existe el endpoint, actualizar
      const existing = await d1First<{ id: string }>(
        'SELECT id FROM v3_push_subscriptions WHERE endpoint = ? LIMIT 1',
        [endpoint]
      )

      const nowIso = new Date().toISOString()
      if (existing) {
        await d1Run(
          `UPDATE v3_push_subscriptions SET userId = ?, p256dhKey = ?, authKey = ? WHERE id = ?`,
          [user.id, keys.p256dh, keys.auth, existing.id]
        )
      } else {
        const newId = uuidv4()
        await d1Run(
          `INSERT INTO v3_push_subscriptions (id, userId, endpoint, p256dhKey, authKey, createdAt)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newId, user.id, endpoint, keys.p256dh, keys.auth, nowIso]
        )
      }

      return NextResponse.json({ success: true })
    }

    // Desarrollo: Prisma — Upsert: si ya existe el endpoint, actualizar
    const existing = await db.pushSubscription.findFirst({
      where: { endpoint },
    })

    if (existing) {
      await db.pushSubscription.update({
        where: { id: existing.id },
        data: {
          userId: user.id,
          p256dhKey: keys.p256dh,
          authKey: keys.auth,
        },
      })
    } else {
      await db.pushSubscription.create({
        data: {
          userId: user.id,
          endpoint,
          p256dhKey: keys.p256dh,
          authKey: keys.auth,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push subscribe error:', error)
    return NextResponse.json({ error: 'Error al suscribir' }, { status: 500 })
  }
}

// DELETE /api/push/subscribe — elimina una suscripción
export async function DELETE(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { endpoint } = body

    if (isD1()) {
      // Producción: D1
      await d1Run(
        'DELETE FROM v3_push_subscriptions WHERE endpoint = ? AND userId = ?',
        [endpoint, user.id]
      )
      return NextResponse.json({ success: true })
    }

    // Desarrollo: Prisma
    await db.pushSubscription.deleteMany({
      where: { endpoint, userId: user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push unsubscribe error:', error)
    return NextResponse.json({ error: 'Error al desuscribir' }, { status: 500 })
  }
}
