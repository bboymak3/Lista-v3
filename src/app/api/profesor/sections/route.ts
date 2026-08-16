import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1Query } from '@/lib/d1'
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

  if (isD1()) {
    // Producción: D1
    // Secciones donde es tutor O está asignado vía SectionAssignment.
    // Para cada sección, traer plantel + count de estudiantes + rol del profesor.
    const rows = await d1Query<{
      id: string
      nombre: string
      grado: string
      turno: string
      plantelId: string
      tutorId: string | null
      periodoEscolar: string
      plantelNombre: string
      studentCount: number
      assignmentRole: string | null
    }>(
      `SELECT DISTINCT s.id, s.nombre, s.grado, s.turno, s.plantelId, s.tutorId, s.periodoEscolar,
              p.nombre AS plantelNombre,
              (SELECT COUNT(*) FROM v3_students st WHERE st.sectionId = s.id AND st.activo = 1) AS studentCount,
              (SELECT sa.role FROM v3_section_assignments sa WHERE sa.sectionId = s.id AND sa.userId = ? LIMIT 1) AS assignmentRole
       FROM v3_sections s
       LEFT JOIN v3_plantels p ON p.id = s.plantelId
       LEFT JOIN v3_section_assignments sa ON sa.sectionId = s.id AND sa.userId = ?
       WHERE s.activa = 1 AND (s.tutorId = ? OR sa.userId = ?)
       ORDER BY s.grado ASC, s.nombre ASC`,
      [payload.id, payload.id, payload.id, payload.id]
    )

    const result = rows.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      grado: s.grado,
      turno: s.turno,
      plantel: s.plantelNombre,
      periodoEscolar: s.periodoEscolar,
      rol: s.tutorId === payload.id ? 'tutor' : s.assignmentRole || 'profesor',
      studentCount: s.studentCount,
    }))

    return NextResponse.json({ sections: result })
  }

  // Desarrollo: Prisma
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
