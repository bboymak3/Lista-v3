import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Query } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/alumno/attendance — historial de asistencia del alumno (últimos 30 días)
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'alumno') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  if (isD1()) {
    // Producción: D1
    const student = await d1First<{ id: string }>(
      'SELECT id FROM v3_students WHERE userId = ? LIMIT 1',
      [payload.id]
    )
    if (!student) {
      return NextResponse.json({ error: 'Perfil de estudiante no encontrado' }, { status: 404 })
    }

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    const records = await d1Query<{
      id: string
      estado: string
      origen: string
      observacion: string | null
      fecha: string
      lat: number | null
      lng: number | null
      sessionId: string | null
      sessionEstado: string | null
      sessionFecha: string | null
    }>(
      `SELECT a.id, a.estado, a.origen, a.observacion, a.fecha, a.lat, a.lng, a.sessionId,
              sess.estado AS sessionEstado, sess.fecha AS sessionFecha
       FROM v3_attendance a
       LEFT JOIN v3_attendance_sessions sess ON sess.id = a.sessionId
       WHERE a.estudianteId = ? AND a.fecha >= ?
       ORDER BY a.fecha DESC
       LIMIT 60`,
      [student.id, thirtyDaysAgo.toISOString()]
    )

    return NextResponse.json({
      historial: records.map((r) => ({
        id: r.id,
        estado: r.estado,
        origen: r.origen,
        observacion: r.observacion,
        fecha: r.fecha,
        lat: r.lat,
        lng: r.lng,
        session: r.sessionId
          ? {
              id: r.sessionId,
              estado: r.sessionEstado,
              fecha: r.sessionFecha,
            }
          : null,
      })),
    })
  }

  // Desarrollo: Prisma
  const student = await db.student.findUnique({
    where: { userId: payload.id },
    select: { id: true },
  })
  if (!student) {
    return NextResponse.json({ error: 'Perfil de estudiante no encontrado' }, { status: 404 })
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const records = await db.attendance.findMany({
    where: {
      estudianteId: student.id,
      fecha: { gte: thirtyDaysAgo },
    },
    orderBy: { fecha: 'desc' },
    take: 60,
    include: {
      session: {
        select: { id: true, estado: true, fecha: true },
      },
    },
  })

  return NextResponse.json({
    historial: records.map((r) => ({
      id: r.id,
      estado: r.estado,
      origen: r.origen,
      observacion: r.observacion,
      fecha: r.fecha,
      lat: r.lat,
      lng: r.lng,
      session: r.session,
    })),
  })
}
