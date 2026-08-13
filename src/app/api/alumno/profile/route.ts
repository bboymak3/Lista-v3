import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/alumno/profile — perfil del alumno (Student) autenticado
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
    include: {
      section: {
        select: {
          id: true,
          nombre: true,
          grado: true,
          turno: true,
          periodoEscolar: true,
          plantel: {
            select: {
              id: true,
              nombre: true,
              direccion: true,
              lat: true,
              lng: true,
              radioM: true,
              periodoActual: true,
            },
          },
        },
      },
    },
  })

  if (!student) {
    return NextResponse.json(
      { error: 'No tienes perfil de estudiante asociado' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    id: student.id,
    codigoUnico: student.codigoUnico,
    cedulaEscolar: student.cedulaEscolar,
    nombre: student.nombre,
    apellido: student.apellido,
    fechaNacimiento: student.fechaNacimiento,
    genero: student.genero,
    qrCode: student.qrCode,
    activo: student.activo,
    section: student.section,
  })
}
