import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First } from '@/lib/d1'
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

  if (isD1()) {
    // Producción: D1 — JOIN students → sections → plantels
    const student = await d1First<{
      id: string
      codigoUnico: string
      cedulaEscolar: string | null
      nombre: string
      apellido: string
      fechaNacimiento: string | null
      genero: string | null
      qrCode: string
      activo: number
      sectionId: string
      sectionNombre: string
      sectionGrado: string
      sectionTurno: string
      sectionPeriodo: string
      plantelId: string
      plantelNombre: string
      plantelDireccion: string | null
      plantelLat: number
      plantelLng: number
      plantelRadioM: number
      plantelPeriodo: string
    }>(
      `SELECT st.id, st.codigoUnico, st.cedulaEscolar, st.nombre, st.apellido, st.fechaNacimiento, st.genero, st.qrCode, st.activo,
              sec.id AS sectionId, sec.nombre AS sectionNombre, sec.grado AS sectionGrado, sec.turno AS sectionTurno, sec.periodoEscolar AS sectionPeriodo,
              p.id AS plantelId, p.nombre AS plantelNombre, p.direccion AS plantelDireccion, p.lat AS plantelLat, p.lng AS plantelLng, p.radioM AS plantelRadioM, p.periodoActual AS plantelPeriodo
       FROM v3_students st
       LEFT JOIN v3_sections sec ON sec.id = st.sectionId
       LEFT JOIN v3_plantels p ON p.id = sec.plantelId
       WHERE st.userId = ? LIMIT 1`,
      [payload.id]
    )

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
      activo: student.activo === 1,
      section: {
        id: student.sectionId,
        nombre: student.sectionNombre,
        grado: student.sectionGrado,
        turno: student.sectionTurno,
        periodoEscolar: student.sectionPeriodo,
        plantel: student.plantelId
          ? {
              id: student.plantelId,
              nombre: student.plantelNombre,
              direccion: student.plantelDireccion,
              lat: student.plantelLat,
              lng: student.plantelLng,
              radioM: student.plantelRadioM,
              periodoActual: student.plantelPeriodo,
            }
          : null,
      },
    })
  }

  // Desarrollo: Prisma
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
