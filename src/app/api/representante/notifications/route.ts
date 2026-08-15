export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/representante/notifications
// Lista notificaciones del representante (no leídas primero, luego por fecha desc).
// Contexto: notificaciones dirigidas al propio representante.
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'representante') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  // Ordenar: no leídas primero, luego por createdAt desc.
  // SQLite no soporta orden booleano directamente — usamos orderBy múltiple.
  const notifications = await db.notification.findMany({
    where: { destinatarioId: payload.id },
    orderBy: [{ leida: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  })

  const noLeidas = notifications.filter((n) => !n.leida).length

  return NextResponse.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      mensaje: n.mensaje,
      leida: n.leida,
      createdAt: n.createdAt,
    })),
    noLeidas,
  })
}
