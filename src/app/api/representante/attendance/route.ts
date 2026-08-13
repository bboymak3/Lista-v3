import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/representante/attendance?estudianteId=xxx
// Lista los registros de asistencia del estudiante (últimos 30 días).
// Incluye: fecha de la sesión, estado, origen.
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'representante') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const estudianteId = searchParams.get('estudianteId')
  if (!estudianteId) {
    return NextResponse.json(
      { error: 'Parámetro estudianteId requerido' },
      { status: 400 }
    )
  }

  const link = await db.parentStudent.findUnique({
    where: {
      representanteId_estudianteId: { representanteId: payload.id, estudianteId },
    },
    select: { id: true },
  })
  if (!link) {
    return NextResponse.json(
      { error: 'No autorizado para este estudiante' },
      { status: 403 }
    )
  }

  const since = new Date()
  since.setDate(since.getDate() - 30)
  since.setHours(0, 0, 0, 0)

  const records = await db.attendance.findMany({
    where: {
      estudianteId,
      fecha: { gte: since },
    },
    include: {
      session: {
        select: {
          id: true,
          fecha: true,
          estado: true,
        },
      },
    },
    orderBy: { fecha: 'desc' },
  })

  const result = records.map((a) => ({
    id: a.id,
    estado: a.estado,
    origen: a.origen,
    observacion: a.observacion,
    fecha: a.fecha,
    session: a.session
      ? {
          id: a.session.id,
          fecha: a.session.fecha,
          estado: a.session.estado,
        }
      : null,
  }))

  return NextResponse.json({ attendance: result })
}
