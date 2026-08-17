import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Query, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

// GET /api/admin/representantes/[id]/students — list students assigned to a representante
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params

  if (isD1()) {
    // Producción: D1 — JOIN parent_student → students → sections
    const rows = await d1Query<{
      ps_id: string
      ps_parentesco: string
      ps_esPrincipal: number
      ps_createdAt: string
      st_id: string
      st_codigoUnico: string
      st_cedulaEscolar: string | null
      st_nombre: string
      st_apellido: string
      st_genero: string | null
      st_activo: number
      sec_id: string
      sec_nombre: string
      sec_grado: string
      sec_turno: string
    }>(
      `SELECT ps.id AS ps_id, ps.parentesco AS ps_parentesco, ps.esPrincipal AS ps_esPrincipal, ps.createdAt AS ps_createdAt,
              st.id AS st_id, st.codigoUnico AS st_codigoUnico, st.cedulaEscolar AS st_cedulaEscolar,
              st.nombre AS st_nombre, st.apellido AS st_apellido, st.genero AS st_genero, st.activo AS st_activo,
              sec.id AS sec_id, sec.nombre AS sec_nombre, sec.grado AS sec_grado, sec.turno AS sec_turno
       FROM v3_parent_student ps
       INNER JOIN v3_students st ON st.id = ps.estudianteId
       INNER JOIN v3_sections sec ON sec.id = st.sectionId
       WHERE ps.representanteId = ?
       ORDER BY ps.esPrincipal DESC, st.apellido ASC, st.nombre ASC`,
      [id]
    )

    const data = rows.map((r) => ({
      id: r.ps_id,
      estudianteId: r.st_id,
      parentesco: r.ps_parentesco,
      esPrincipal: r.ps_esPrincipal === 1,
      createdAt: r.ps_createdAt,
      estudiante: {
        id: r.st_id,
        codigoUnico: r.st_codigoUnico,
        cedulaEscolar: r.st_cedulaEscolar,
        nombre: r.st_nombre,
        apellido: r.st_apellido,
        genero: r.st_genero,
        activo: r.st_activo === 1,
        section: {
          id: r.sec_id,
          nombre: r.sec_nombre,
          grado: r.sec_grado,
          turno: r.sec_turno,
        },
      },
    }))

    return NextResponse.json({ data })
  }

  // Desarrollo: Prisma
  const links = await db.parentStudent.findMany({
    where: { representanteId: id },
    include: {
      estudiante: {
        select: {
          id: true,
          codigoUnico: true,
          cedulaEscolar: true,
          nombre: true,
          apellido: true,
          genero: true,
          activo: true,
          section: { select: { id: true, nombre: true, grado: true, turno: true } },
        },
      },
    },
    orderBy: [{ esPrincipal: 'desc' }, { estudiante: { apellido: 'asc' } }],
  })

  const data = links.map((l) => ({
    id: l.id,
    estudianteId: l.estudianteId,
    parentesco: l.parentesco,
    esPrincipal: l.esPrincipal,
    createdAt: l.createdAt,
    estudiante: {
      ...l.estudiante,
      section: l.estudiante.section,
    },
  }))

  return NextResponse.json({ data })
}

// POST /api/admin/representantes/[id]/students — assign a student to this representante
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const { id: representanteId } = await params
    const body = await request.json()
    const { estudianteId, parentesco, esPrincipal } = body

    if (!estudianteId || !parentesco) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (estudianteId, parentesco)' },
        { status: 400 }
      )
    }

    const validParentesco = ['madre', 'padre', 'tutor', 'otro']
    if (!validParentesco.includes(parentesco)) {
      return NextResponse.json({ error: 'Parentesco inválido' }, { status: 400 })
    }

    const esPrincipalBool = esPrincipal !== false // default true

    if (isD1()) {
      // Producción: D1
      // Verificar que el representante existe y es representante
      const rep = await d1First<{ id: string; rol: string }>(
        `SELECT id, rol FROM v3_users WHERE id = ? LIMIT 1`,
        [representanteId]
      )
      if (!rep) {
        return NextResponse.json({ error: 'Representante no encontrado' }, { status: 404 })
      }
      if (rep.rol !== 'representante') {
        return NextResponse.json(
          { error: 'El usuario no tiene rol representante' },
          { status: 400 }
        )
      }

      // Verificar que el estudiante existe
      const student = await d1First<{ id: string; nombre: string; apellido: string }>(
        'SELECT id, nombre, apellido FROM v3_students WHERE id = ? LIMIT 1',
        [estudianteId]
      )
      if (!student) {
        return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })
      }

      // Verificar si ya está asignado a este representante
      const existingLink = await d1First<{ id: string }>(
        'SELECT id FROM v3_parent_student WHERE representanteId = ? AND estudianteId = ? LIMIT 1',
        [representanteId, estudianteId]
      )
      if (existingLink) {
        return NextResponse.json(
          { error: 'Este estudiante ya está asignado a este representante' },
          { status: 409 }
        )
      }

      // Si esPrincipal=true, actualizar otros enlaces principales del estudiante a false
      // (regla: un representante por alumno como principal, pero un representante puede tener varios estudiantes)
      if (esPrincipalBool) {
        await d1Run(
          `UPDATE v3_parent_student SET esPrincipal = 0 WHERE estudianteId = ? AND esPrincipal = 1`,
          [estudianteId]
        )
      }

      const newId = uuidv4()
      const now = new Date().toISOString()
      await d1Run(
        `INSERT INTO v3_parent_student (id, representanteId, estudianteId, parentesco, esPrincipal, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newId, representanteId, estudianteId, parentesco, esPrincipalBool ? 1 : 0, now]
      )

      const created = await d1First<{
        id: string
        parentesco: string
        esPrincipal: number
        createdAt: string
      }>(
        'SELECT id, parentesco, esPrincipal, createdAt FROM v3_parent_student WHERE id = ? LIMIT 1',
        [newId]
      )

      return NextResponse.json(
        {
          id: created?.id,
          estudianteId,
          representanteId,
          parentesco: created?.parentesco,
          esPrincipal: (created?.esPrincipal ?? 0) === 1,
          createdAt: created?.createdAt,
        },
        { status: 201 }
      )
    }

    // Desarrollo: Prisma
    const rep = await db.user.findUnique({
      where: { id: representanteId },
      select: { id: true, rol: true },
    })
    if (!rep) {
      return NextResponse.json({ error: 'Representante no encontrado' }, { status: 404 })
    }
    if (rep.rol !== 'representante') {
      return NextResponse.json(
        { error: 'El usuario no tiene rol representante' },
        { status: 400 }
      )
    }

    const student = await db.student.findUnique({
      where: { id: estudianteId },
      select: { id: true, nombre: true, apellido: true },
    })
    if (!student) {
      return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })
    }

    const existingLink = await db.parentStudent.findUnique({
      where: {
        representanteId_estudianteId: { representanteId, estudianteId },
      },
    })
    if (existingLink) {
      return NextResponse.json(
        { error: 'Este estudiante ya está asignado a este representante' },
        { status: 409 }
      )
    }

    // Si esPrincipal, demover otros principales del estudiante
    if (esPrincipalBool) {
      await db.parentStudent.updateMany({
        where: { estudianteId, esPrincipal: true },
        data: { esPrincipal: false },
      })
    }

    const created = await db.parentStudent.create({
      data: {
        representanteId,
        estudianteId,
        parentesco,
        esPrincipal: esPrincipalBool,
      },
      select: {
        id: true,
        parentesco: true,
        esPrincipal: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      {
        id: created.id,
        estudianteId,
        representanteId,
        parentesco: created.parentesco,
        esPrincipal: created.esPrincipal,
        createdAt: created.createdAt,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Assign student error:', error)
    return NextResponse.json({ error: 'Error al asignar estudiante' }, { status: 500 })
  }
}
