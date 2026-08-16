import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1Query, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/notifications — lista notificaciones del usuario autenticado
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (isD1()) {
    // Producción: D1
    const notifications = await d1Query<{
      id: string
      tipo: string
      titulo: string
      mensaje: string
      leida: number
      createdAt: string
    }>(
      `SELECT id, tipo, titulo, mensaje, leida, createdAt
       FROM v3_notifications
       WHERE destinatarioId = ?
       ORDER BY createdAt DESC
       LIMIT 50`,
      [payload.id]
    )

    const normalized = notifications.map((n) => ({
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      mensaje: n.mensaje,
      leida: n.leida === 1,
      createdAt: n.createdAt,
    }))

    const noLeidas = normalized.filter((n) => !n.leida).length

    return NextResponse.json({
      notifications: normalized,
      noLeidas,
    })
  }

  // Desarrollo: Prisma
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

  if (isD1()) {
    // Producción: D1
    if (id) {
      const existing = await d1First<{ id: string; destinatarioId: string }>(
        'SELECT id, destinatarioId FROM v3_notifications WHERE id = ? LIMIT 1',
        [id]
      )
      if (!existing || existing.destinatarioId !== payload.id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
      await d1Run('UPDATE v3_notifications SET leida = 1 WHERE id = ?', [id])
      return NextResponse.json({ ok: true })
    }

    // Sin id -> marcar todas como leídas
    await d1Run(
      'UPDATE v3_notifications SET leida = 1 WHERE destinatarioId = ? AND leida = 0',
      [payload.id]
    )
    return NextResponse.json({ ok: true })
  }

  // Desarrollo: Prisma
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
