import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/notifications — lista notificaciones del usuario autenticado
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const notifications = await db.notification.findMany({
    where: { destinatarioId: payload.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const noLeidas = notifications.filter((n) => !n.leida).length

  return NextResponse.json({
    notifications,
    noLeidas,
  })
}

// PUT /api/notifications?id=xxx — marcar como leída
export async function PUT(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    const existing = await db.notification.findUnique({ where: { id } })
    if (!existing || existing.destinatarioId !== payload.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    await db.notification.update({
      where: { id },
      data: { leida: true },
    })
    return NextResponse.json({ ok: true })
  }

  // Sin id -> marcar todas como leídas
  await db.notification.updateMany({
    where: { destinatarioId: payload.id, leida: false },
    data: { leida: true },
  })
  return NextResponse.json({ ok: true })
}
