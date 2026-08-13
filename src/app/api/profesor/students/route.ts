import { NextRequest, NextResponse } from 'next/server'
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
