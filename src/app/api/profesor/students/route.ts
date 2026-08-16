import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Query } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/profesor/students?sectionId=xxx — lista estudiantes de una sección
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'profesor') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const sectionId = searchParams.get('sectionId')
  if (!sectionId) {
    return NextResponse.json({ error: 'sectionId es requerido' }, { status: 400 })
  }

  if (isD1()) {
    // Producción: D1
    // Validar acceso: tutor o asignado
    const section = await d1First<{ id: string }>(
      `SELECT s.id FROM v3_sections s
       LEFT JOIN v3_section_assignments sa ON sa.sectionId = s.id AND sa.userId = ?
       WHERE s.id = ? AND (s.tutorId = ? OR sa.userId = ?) LIMIT 1`,
      [payload.id, sectionId, payload.id, payload.id]
    )
    if (!section) {
      return NextResponse.json({ error: 'Sección no autorizada' }, { status: 403 })
    }

    const students = await d1Query<{
      id: string
      codigoUnico: string
      cedulaEscolar: string | null
      nombre: string
      apellido: string
      genero: string | null
      fotoKey: string | null
    }>(
      `SELECT id, codigoUnico, cedulaEscolar, nombre, apellido, genero, fotoKey
       FROM v3_students
       WHERE sectionId = ? AND activo = 1
       ORDER BY apellido ASC, nombre ASC`,
      [sectionId]
    )

    return NextResponse.json({ students })
  }

  // Desarrollo: Prisma
  // Validar que el profesor tenga acceso a esa sección
  const section = await db.section.findFirst({
    where: {
      id: sectionId,
      OR: [{ tutorId: payload.id }, { assignments: { some: { userId: payload.id } } }],
    },
    select: { id: true },
  })
  if (!section) {
    return NextResponse.json({ error: 'Sección no autorizada' }, { status: 403 })
  }

  const students = await db.student.findMany({
    where: { sectionId, activo: true },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    select: {
      id: true,
      codigoUnico: true,
      cedulaEscolar: true,
      nombre: true,
      apellido: true,
      genero: true,
      fotoKey: true,
    },
  })

  return NextResponse.json({ students })
}
