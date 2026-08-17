import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1Query, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

// GET /api/admin/students — list students (with pagination + filters)
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
  const sectionId = searchParams.get('sectionId') || undefined
  const search = searchParams.get('search') || undefined
  const includeInactive = searchParams.get('includeInactive') === 'true'

  if (isD1()) {
    // Producción: SQL crudo contra v3_students, JOIN sections y parents
    const where: string[] = []
    const params: unknown[] = []
    if (!includeInactive) {
      where.push('s.activo = 1')
    }
    if (sectionId) {
      where.push('s.sectionId = ?')
      params.push(sectionId)
    }
    let searchWhere = ''
    if (search) {
      where.push(
        '(s.nombre LIKE ? OR s.apellido LIKE ? OR s.codigoUnico LIKE ? OR s.cedulaEscolar LIKE ?)'
      )
      const like = `%${search}%`
      params.push(like, like, like, like)
      searchWhere = ''
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    // Total count
    const totalRow = await d1First<{ count: number }>(
      `SELECT COUNT(*) as count FROM v3_students s ${whereSql}`,
      params
    )
    const total = totalRow?.count || 0

    // Paged rows + section info via JOIN
    const offset = (page - 1) * limit
    const rows = await d1Query<{
      id: string
      codigoUnico: string
      cedulaEscolar: string | null
      nombre: string
      apellido: string
      fechaNacimiento: string | null
      genero: string | null
      sectionId: string
      qrCode: string
      fotoKey: string | null
      activo: number
      createdAt: string
      updatedAt: string
      sectionId_section: string
      sectionNombre: string
      sectionGrado: string
      sectionTurno: string
    }>(
      `SELECT s.*, sec.id AS sectionId_section, sec.nombre AS sectionNombre, sec.grado AS sectionGrado, sec.turno AS sectionTurno
       FROM v3_students s
       LEFT JOIN v3_sections sec ON sec.id = s.sectionId
       ${whereSql}
       ORDER BY s.apellido ASC, s.nombre ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    // Para cada estudiante, buscar sus padres (ParentStudent + User)
    const studentIds = rows.map((r) => r.id)
    let parentsMap: Record<string, any[]> = {}
    if (studentIds.length > 0) {
      const parentRows = await d1Query<{
        id: string
        estudianteId: string
        representanteId: string
        parentesco: string
        esPrincipal: number
        createdAt: string
        r_id: string
        r_nombre: string
        r_apellido: string
        r_cedula: string
        r_telefono: string | null
      }>(
        `SELECT ps.id, ps.estudianteId, ps.representanteId, ps.parentesco, ps.esPrincipal, ps.createdAt,
                u.id AS r_id, u.nombre AS r_nombre, u.apellido AS r_apellido, u.cedula AS r_cedula, u.telefono AS r_telefono
         FROM v3_parent_student ps
         INNER JOIN v3_users u ON u.id = ps.representanteId
         WHERE ps.estudianteId IN (${studentIds.map(() => '?').join(', ')})`,
        studentIds
      )
      for (const pr of parentRows) {
        if (!parentsMap[pr.estudianteId]) parentsMap[pr.estudianteId] = []
        parentsMap[pr.estudianteId].push({
          id: pr.id,
          estudianteId: pr.estudianteId,
          representanteId: pr.representanteId,
          parentesco: pr.parentesco,
          esPrincipal: pr.esPrincipal === 1,
          createdAt: pr.createdAt,
          representante: {
            id: pr.r_id,
            nombre: pr.r_nombre,
            apellido: pr.r_apellido,
            cedula: pr.r_cedula,
            telefono: pr.r_telefono,
          },
        })
      }
    }

    const data = rows.map((r) => ({
      id: r.id,
      codigoUnico: r.codigoUnico,
      cedulaEscolar: r.cedulaEscolar,
      nombre: r.nombre,
      apellido: r.apellido,
      fechaNacimiento: r.fechaNacimiento,
      genero: r.genero,
      sectionId: r.sectionId,
      qrCode: r.qrCode,
      fotoKey: r.fotoKey,
      activo: r.activo === 1,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      section: r.sectionId_section
        ? {
            id: r.sectionId_section,
            nombre: r.sectionNombre,
            grado: r.sectionGrado,
            turno: r.sectionTurno,
          }
        : null,
      parents: parentsMap[r.id] || [],
    }))

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  }

  // Desarrollo: Prisma
  const where: any = {}
  if (!includeInactive) where.activo = true
  if (sectionId) where.sectionId = sectionId
  if (search) {
    where.OR = [
      { nombre: { contains: search } },
      { apellido: { contains: search } },
      { codigoUnico: { contains: search } },
      { cedulaEscolar: { contains: search } },
    ]
  }

  const [students, total] = await Promise.all([
    db.student.findMany({
      where,
      include: {
        section: { select: { id: true, nombre: true, grado: true, turno: true } },
        parents: {
          include: {
            representante: {
              select: { id: true, nombre: true, apellido: true, cedula: true, telefono: true },
            },
          },
        },
      },
      orderBy: { apellido: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.student.count({ where }),
  ])

  return NextResponse.json({
    data: students,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}

// POST /api/admin/students — create a student
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { codigoUnico, cedulaEscolar, nombre, apellido, fechaNacimiento, genero, sectionId } = body

    if (!codigoUnico || !nombre || !apellido || !sectionId) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (codigoUnico, nombre, apellido, sectionId)' },
        { status: 400 }
      )
    }

    if (isD1()) {
      // Producción: D1
      // Verificar que la sección existe
      const section = await d1First<{ id: string }>(
        'SELECT id FROM v3_sections WHERE id = ? LIMIT 1',
        [sectionId]
      )
      if (!section) {
        return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
      }

      // Verificar unicidad de codigoUnico
      const existing = await d1First<{ id: string }>(
        'SELECT id FROM v3_students WHERE codigoUnico = ? LIMIT 1',
        [codigoUnico]
      )
      if (existing) {
        return NextResponse.json({ error: 'El código único ya existe' }, { status: 409 })
      }

      // Verificar cedulaEscolar única si viene
      if (cedulaEscolar) {
        const existingCedula = await d1First<{ id: string }>(
          'SELECT id FROM v3_students WHERE cedulaEscolar = ? LIMIT 1',
          [cedulaEscolar]
        )
        if (existingCedula) {
          return NextResponse.json(
            { error: 'La cédula escolar ya está registrada' },
            { status: 409 }
          )
        }
      }

      const newId = uuidv4()
      const qrCode = uuidv4()
      const now = new Date().toISOString()
      await d1Run(
        `INSERT INTO v3_students (id, codigoUnico, cedulaEscolar, nombre, apellido, fechaNacimiento, genero, sectionId, userId, fotoKey, qrCode, activo, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 1, ?, ?)`,
        [
          newId,
          codigoUnico,
          cedulaEscolar || null,
          nombre,
          apellido,
          fechaNacimiento || null,
          genero || null,
          sectionId,
          qrCode,
          now,
          now,
        ]
      )

      // Recuperar el estudiante creado + sección
      const created = await d1First<{
        id: string
        codigoUnico: string
        cedulaEscolar: string | null
        nombre: string
        apellido: string
        fechaNacimiento: string | null
        genero: string | null
        sectionId: string
        qrCode: string
        activo: number
        sectionNombre: string
        sectionGrado: string
        sectionTurno: string
        sectionId_section: string
      }>(
        `SELECT s.*, sec.id AS sectionId_section, sec.nombre AS sectionNombre, sec.grado AS sectionGrado, sec.turno AS sectionTurno
         FROM v3_students s
         LEFT JOIN v3_sections sec ON sec.id = s.sectionId
         WHERE s.id = ? LIMIT 1`,
        [newId]
      )

      return NextResponse.json(
        {
          id: created?.id,
          codigoUnico: created?.codigoUnico,
          cedulaEscolar: created?.cedulaEscolar,
          nombre: created?.nombre,
          apellido: created?.apellido,
          fechaNacimiento: created?.fechaNacimiento,
          genero: created?.genero,
          sectionId: created?.sectionId,
          qrCode: created?.qrCode,
          activo: created?.activo === 1,
          section: created?.sectionId_section
            ? {
                id: created.sectionId_section,
                nombre: created.sectionNombre,
                grado: created.sectionGrado,
                turno: created.sectionTurno,
              }
            : null,
        },
        { status: 201 }
      )
    }

    // Desarrollo: Prisma
    // Verificar que la sección existe
    const section = await db.section.findUnique({ where: { id: sectionId } })
    if (!section) {
      return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
    }

    // Verificar unicidad de codigoUnico
    const existing = await db.student.findUnique({ where: { codigoUnico } })
    if (existing) {
      return NextResponse.json({ error: 'El código único ya existe' }, { status: 409 })
    }

    // Verificar cedulaEscolar única si viene
    if (cedulaEscolar) {
      const existingCedula = await db.student.findUnique({ where: { cedulaEscolar } })
      if (existingCedula) {
        return NextResponse.json({ error: 'La cédula escolar ya está registrada' }, { status: 409 })
      }
    }

    const student = await db.student.create({
      data: {
        codigoUnico,
        cedulaEscolar: cedulaEscolar || null,
        nombre,
        apellido,
        fechaNacimiento: fechaNacimiento || null,
        genero: genero || null,
        sectionId,
        qrCode: uuidv4(),
      },
      include: {
        section: { select: { id: true, nombre: true, grado: true, turno: true } },
      },
    })

    return NextResponse.json(student, { status: 201 })
  } catch (error) {
    console.error('Create student error:', error)
    return NextResponse.json({ error: 'Error al crear estudiante' }, { status: 500 })
  }
}
