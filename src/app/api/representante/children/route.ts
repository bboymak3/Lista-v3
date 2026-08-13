import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/representante/children
// Lista los hijos del representante autenticado (vía ParentStudent).
// Incluye sección (nombre, grado, turno) y plantel (lat, lng, radioM).
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'representante') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const links = await db.parentStudent.findMany({
    where: { representanteId: payload.id },
    include: {
      estudiante: {
        include: {
          section: {
            include: {
              plantel: true,
            },
          },
        },
      },
    },
    orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
  })

  const children = links.map((l) => ({
    id: l.estudiante.id,
    codigoUnico: l.estudiante.codigoUnico,
    nombre: l.estudiante.nombre,
    apellido: l.estudiante.apellido,
    genero: l.estudiante.genero,
    parentesco: l.parentesco,
    esPrincipal: l.esPrincipal,
    section: {
      id: l.estudiante.section.id,
      nombre: l.estudiante.section.nombre,
      grado: l.estudiante.section.grado,
      turno: l.estudiante.section.turno,
      plantel: {
        id: l.estudiante.section.plantel.id,
        nombre: l.estudiante.section.plantel.nombre,
        direccion: l.estudiante.section.plantel.direccion,
        lat: l.estudiante.section.plantel.lat,
        lng: l.estudiante.section.plantel.lng,
        radioM: l.estudiante.section.plantel.radioM,
      },
    },
  }))

  return NextResponse.json({ children })
}
