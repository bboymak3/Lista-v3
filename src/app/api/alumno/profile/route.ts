import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Query } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

interface RepInfo {
  id: string
  nombre: string
  apellido: string
  telefono: string | null
  whatsapp: string | null
  parentesco: string
  esPrincipal: boolean
}

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
      fotoKey: string | null
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
      `SELECT st.id, st.codigoUnico, st.cedulaEscolar, st.nombre, st.apellido, st.fechaNacimiento, st.genero, st.qrCode, st.fotoKey, st.activo,
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

    // Buscar representante vinculado (ParentStudent JOIN v3_users)
    const repRows = await d1Query<{
      id: string
      nombre: string
      apellido: string
      telefono: string | null
      whatsapp: string | null
      parentesco: string
      esPrincipal: number
    }>(
      `SELECT u.id, u.nombre, u.apellido, u.telefono, u.whatsapp, ps.parentesco, ps.esPrincipal
       FROM v3_parent_student ps
       INNER JOIN v3_users u ON u.id = ps.representanteId
       WHERE ps.estudianteId = ?
       ORDER BY ps.esPrincipal DESC, u.nombre ASC`,
      [student.id]
    )
    const representantes: RepInfo[] = repRows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      apellido: r.apellido,
      telefono: r.telefono,
      whatsapp: r.whatsapp,
      parentesco: r.parentesco,
      esPrincipal: r.esPrincipal === 1,
    }))

    return NextResponse.json({
      id: student.id,
      codigoUnico: student.codigoUnico,
      cedulaEscolar: student.cedulaEscolar,
      nombre: student.nombre,
      apellido: student.apellido,
      fechaNacimiento: student.fechaNacimiento,
      genero: student.genero,
      qrCode: student.qrCode,
      fotoKey: student.fotoKey,
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
      representantes,
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
      parents: {
        select: {
          parentesco: true,
          esPrincipal: true,
          representante: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              telefono: true,
              whatsapp: true,
            },
          },
        },
        orderBy: { esPrincipal: 'desc' },
      },
    },
  })

  if (!student) {
    return NextResponse.json(
      { error: 'No tienes perfil de estudiante asociado' },
      { status: 404 }
    )
  }

  const representantes: RepInfo[] = student.parents.map((p) => ({
    id: p.representante.id,
    nombre: p.representante.nombre,
    apellido: p.representante.apellido,
    telefono: p.representante.telefono,
    whatsapp: p.representante.whatsapp,
    parentesco: p.parentesco,
    esPrincipal: p.esPrincipal,
  }))

  return NextResponse.json({
    id: student.id,
    codigoUnico: student.codigoUnico,
    cedulaEscolar: student.cedulaEscolar,
    nombre: student.nombre,
    apellido: student.apellido,
    fechaNacimiento: student.fechaNacimiento,
    genero: student.genero,
    qrCode: student.qrCode,
    fotoKey: student.fotoKey,
    activo: student.activo,
    section: student.section,
    representantes,
  })
}
