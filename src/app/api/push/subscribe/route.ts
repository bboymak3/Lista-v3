export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

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

    // Upsert: si ya existe el endpoint, actualizar
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

    await db.pushSubscription.deleteMany({
      where: { endpoint, userId: user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push unsubscribe error:', error)
    return NextResponse.json({ error: 'Error al desuscribir' }, { status: 500 })
  }
}
