import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/profesor/sections — lista secciones asignadas al profesor
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'profesor') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  // Secciones donde es tutor o está asignado
  const sections = await db.section.findMany({
    where: {
      OR: [{ tutorId: payload.id }, { assignments: { some: { userId: payload.id } } }],
      activa: true,
    },
    include: {
      plantel: { select: { nombre: true } },
      _count: { select: { students: { where: { activo: true } } } },
      assignments: {
        where: { userId: payload.id },
        select: { role: true },
      },
    },
    orderBy: [{ grado: 'asc' }, { nombre: 'asc' }],
  })

  const result = sections.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    grado: s.grado,
    turno: s.turno,
    plantel: s.plantel.nombre,
    periodoEscolar: s.periodoEscolar,
    rol: s.tutorId === payload.id ? 'tutor' : s.assignments[0]?.role || 'profesor',
    studentCount: s._count.students,
  }))

  return NextResponse.json({ sections: result })
}
