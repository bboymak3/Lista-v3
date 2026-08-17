import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1Query, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { getUserPlantelId } from '@/lib/auth-helpers'
import { v4 as uuidv4 } from 'uuid'

// GET /api/admin/sections — list sections with plantel, tutor, studentCount
// - admin: only sections in their plantelId
// - super_admin: all sections (or ?plantelId=)
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || (user.rol !== 'admin' && user.rol !== 'super_admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const isSuperAdmin = user.rol === 'super_admin'

  const { searchParams } = new URL(request.url)
  const queryPlantelId = searchParams.get('plantelId') || undefined
  const includeInactive = searchParams.get('includeInactive') === 'true'

  // Determine plantelId filter
  let plantelIdFilter: string | null | undefined
  if (isSuperAdmin) {
    plantelIdFilter = queryPlantelId || null // null = all
  } else {
    plantelIdFilter = await getUserPlantelId(request)
    if (!plantelIdFilter) {
      return NextResponse.json({ data: [] })
    }
  }

  if (isD1()) {
    // Producción: SQL crudo con subqueries para _count y JOINs para plantel/tutor
    const where: string[] = []
    const params: unknown[] = []
    if (!includeInactive) where.push('s.activa = 1')
    if (plantelIdFilter) {
      where.push('s.plantelId = ?')
      params.push(plantelIdFilter)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const rows = await d1Query<{
      id: string
      nombre: string
      grado: string
      turno: string
      plantelId: string
      tutorId: string | null
      periodoEscolar: string
      activa: number
      plantelNombre: string
      tutorNombre: string
      tutorApellido: string
      tutorCedula: string
      studentCount: number
    }>(
      `SELECT s.id, s.nombre, s.grado, s.turno, s.plantelId, s.tutorId, s.periodoEscolar, s.activa,
              p.nombre AS plantelNombre,
              u.nombre AS tutorNombre, u.apellido AS tutorApellido, u.cedula AS tutorCedula,
              (SELECT COUNT(*) FROM v3_students st WHERE st.sectionId = s.id AND st.activo = 1) AS studentCount
       FROM v3_sections s
       LEFT JOIN v3_plantels p ON p.id = s.plantelId
       LEFT JOIN v3_users u ON u.id = s.tutorId
       ${whereSql}
       ORDER BY s.grado ASC, s.nombre ASC`,
      params
    )

    const result = rows.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      grado: s.grado,
      turno: s.turno,
      plantelId: s.plantelId,
      plantel: s.plantelNombre ? { id: s.plantelId, nombre: s.plantelNombre } : null,
      tutorId: s.tutorId,
      tutor: s.tutorId
        ? {
            id: s.tutorId,
            nombre: s.tutorNombre,
            apellido: s.tutorApellido,
            cedula: s.tutorCedula,
          }
        : null,
      periodoEscolar: s.periodoEscolar,
      activa: s.activa === 1,
      studentCount: s.studentCount,
    }))

    return NextResponse.json({ data: result })
  }

  // Desarrollo: Prisma
  const where: any = {}
  if (!includeInactive) where.activa = true
  if (plantelIdFilter) where.plantelId = plantelIdFilter

  const sections = await db.section.findMany({
    where,
    include: {
      plantel: { select: { id: true, nombre: true } },
      tutor: { select: { id: true, nombre: true, apellido: true, cedula: true } },
      _count: { select: { students: true } },
    },
    orderBy: [{ grado: 'asc' }, { nombre: 'asc' }],
  })

  const result = sections.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    grado: s.grado,
    turno: s.turno,
    plantelId: s.plantelId,
    plantel: s.plantel,
    tutorId: s.tutorId,
    tutor: s.tutor,
    periodoEscolar: s.periodoEscolar,
    activa: s.activa,
    studentCount: s._count.students,
  }))

  return NextResponse.json({ data: result })
}

// POST /api/admin/sections — create section
// - admin: plantelId must be their own plantelId
// - super_admin: can create in any plantel
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || (user.rol !== 'admin' && user.rol !== 'super_admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const isSuperAdmin = user.rol === 'super_admin'

  try {
    const body = await request.json()
    let { nombre, grado, turno, plantelId, tutorId } = body

    if (!nombre || !grado || !turno || !plantelId) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (nombre, grado, turno, plantelId)' },
        { status: 400 }
      )
    }

    // Para admin: forzar plantelId al suyo
    if (!isSuperAdmin) {
      const userPlantelId = await getUserPlantelId(request)
      if (!userPlantelId) {
        return NextResponse.json({ error: 'No tienes plantel asignado' }, { status: 403 })
      }
      if (plantelId !== userPlantelId) {
        return NextResponse.json({ error: 'No puedes crear secciones en otro plantel' }, { status: 403 })
      }
    }

    if (isD1()) {
      // Producción: D1
      const plantel = await d1First<{ id: string; periodoActual: string }>(
        'SELECT id, periodoActual FROM v3_plantels WHERE id = ? LIMIT 1',
        [plantelId]
      )
      if (!plantel) {
        return NextResponse.json({ error: 'Plantel no encontrado' }, { status: 404 })
      }

      if (tutorId) {
        const tutor = await d1First<{ id: string; rol: string }>(
          'SELECT id, rol FROM v3_users WHERE id = ? LIMIT 1',
          [tutorId]
        )
        if (!tutor || tutor.rol !== 'profesor') {
          return NextResponse.json({ error: 'Tutor inválido o no es profesor' }, { status: 400 })
        }
      }

      const newId = uuidv4()
      const now = new Date().toISOString()
      await d1Run(
        `INSERT INTO v3_sections (id, nombre, grado, turno, plantelId, tutorId, periodoEscolar, activa, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [newId, nombre, grado, turno, plantelId, tutorId || null, plantel.periodoActual, now, now]
      )

      // Si hay tutor, crear SectionAssignment (upsert)
      if (tutorId) {
        const existingAssignment = await d1First<{ id: string }>(
          'SELECT id FROM v3_section_assignments WHERE sectionId = ? AND userId = ? LIMIT 1',
          [newId, tutorId]
        )
        if (existingAssignment) {
          await d1Run('UPDATE v3_section_assignments SET role = ? WHERE id = ?', [
            'tutor',
            existingAssignment.id,
          ])
        } else {
          const aId = uuidv4()
          await d1Run(
            'INSERT INTO v3_section_assignments (id, sectionId, userId, role, createdAt) VALUES (?, ?, ?, ?, ?)',
            [aId, newId, tutorId, 'tutor', now]
          )
        }
      }

      // Recuperar la sección creada + plantel + tutor
      const created = await d1First<{
        id: string
        nombre: string
        grado: string
        turno: string
        plantelId: string
        tutorId: string | null
        periodoEscolar: string
        activa: number
        plantelNombre: string
        tutorNombre: string
        tutorApellido: string
        tutorCedula: string
      }>(
        `SELECT s.id, s.nombre, s.grado, s.turno, s.plantelId, s.tutorId, s.periodoEscolar, s.activa,
                p.nombre AS plantelNombre,
                u.nombre AS tutorNombre, u.apellido AS tutorApellido, u.cedula AS tutorCedula
         FROM v3_sections s
         LEFT JOIN v3_plantels p ON p.id = s.plantelId
         LEFT JOIN v3_users u ON u.id = s.tutorId
         WHERE s.id = ? LIMIT 1`,
        [newId]
      )

      return NextResponse.json(
        {
          id: created?.id,
          nombre: created?.nombre,
          grado: created?.grado,
          turno: created?.turno,
          plantelId: created?.plantelId,
          tutorId: created?.tutorId,
          periodoEscolar: created?.periodoEscolar,
          activa: created?.activa === 1,
          plantel: created?.plantelNombre
            ? { id: created.plantelId, nombre: created.plantelNombre }
            : null,
          tutor: created?.tutorId
            ? {
                id: created.tutorId,
                nombre: created.tutorNombre,
                apellido: created.tutorApellido,
                cedula: created.tutorCedula,
              }
            : null,
        },
        { status: 201 }
      )
    }

    // Desarrollo: Prisma
    const plantel = await db.plantel.findUnique({ where: { id: plantelId } })
    if (!plantel) {
      return NextResponse.json({ error: 'Plantel no encontrado' }, { status: 404 })
    }

    if (tutorId) {
      const tutor = await db.user.findUnique({ where: { id: tutorId } })
      if (!tutor || tutor.rol !== 'profesor') {
        return NextResponse.json({ error: 'Tutor inválido o no es profesor' }, { status: 400 })
      }
    }

    const section = await db.section.create({
      data: {
        nombre,
        grado,
        turno,
        plantelId,
        tutorId: tutorId || null,
        periodoEscolar: plantel.periodoActual,
      },
      include: {
        plantel: { select: { id: true, nombre: true } },
        tutor: { select: { id: true, nombre: true, apellido: true, cedula: true } },
      },
    })

    // Si hay tutor, crear SectionAssignment
    if (tutorId) {
      await db.sectionAssignment.upsert({
        where: { sectionId_userId: { sectionId: section.id, userId: tutorId } },
        update: { role: 'tutor' },
        create: { sectionId: section.id, userId: tutorId, role: 'tutor' },
      })
    }

    return NextResponse.json(section, { status: 201 })
  } catch (error) {
    console.error('Create section error:', error)
    return NextResponse.json({ error: 'Error al crear sección' }, { status: 500 })
  }
}
