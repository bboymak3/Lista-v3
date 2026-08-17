import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1Query } from '@/lib/d1'
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

  if (isD1()) {
    // Producción: D1 — JOIN parent_student → students → sections → plantels
    const rows = await d1Query<{
      id: string
      codigoUnico: string
      nombre: string
      apellido: string
      genero: string | null
      parentesco: string
      esPrincipal: number
      fotoKey: string | null
      sectionId: string
      sectionNombre: string
      sectionGrado: string
      sectionTurno: string
      plantelId: string
      plantelNombre: string
      plantelDireccion: string | null
      plantelLat: number
      plantelLng: number
      plantelRadioM: number
    }>(
      `SELECT ps.id, ps.parentesco, ps.esPrincipal,
              st.id AS id, st.codigoUnico, st.nombre, st.apellido, st.genero, st.fotoKey, st.sectionId,
              sec.id AS sectionId, sec.nombre AS sectionNombre, sec.grado AS sectionGrado, sec.turno AS sectionTurno,
              p.id AS plantelId, p.nombre AS plantelNombre, p.direccion AS plantelDireccion, p.lat AS plantelLat, p.lng AS plantelLng, p.radioM AS plantelRadioM
       FROM v3_parent_student ps
       INNER JOIN v3_students st ON st.id = ps.estudianteId
       INNER JOIN v3_sections sec ON sec.id = st.sectionId
       LEFT JOIN v3_plantels p ON p.id = sec.plantelId
       WHERE ps.representanteId = ?
       ORDER BY ps.esPrincipal DESC, ps.createdAt ASC`,
      [payload.id]
    )

    const children = rows.map((l) => ({
      id: l.id,
      codigoUnico: l.codigoUnico,
      nombre: l.nombre,
      apellido: l.apellido,
      genero: l.genero,
      parentesco: l.parentesco,
      esPrincipal: l.esPrincipal === 1,
      fotoKey: l.fotoKey,
      section: {
        id: l.sectionId,
        nombre: l.sectionNombre,
        grado: l.sectionGrado,
        turno: l.sectionTurno,
        plantel: {
          id: l.plantelId,
          nombre: l.plantelNombre,
          direccion: l.plantelDireccion,
          lat: l.plantelLat,
          lng: l.plantelLng,
          radioM: l.plantelRadioM,
        },
      },
    }))

    return NextResponse.json({ children })
  }

  // Desarrollo: Prisma
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
    fotoKey: l.estudiante.fotoKey,
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
