export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'

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
