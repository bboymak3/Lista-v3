import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Query, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { hashPassword } from '@/lib/db-auth'
import { v4 as uuidv4 } from 'uuid'

// GET /api/admin/representantes — list representantes with their assigned students count
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const includeInactive = searchParams.get('includeInactive') === 'true'
  const search = searchParams.get('search') || undefined

  if (isD1()) {
    // Producción: D1
    const where: string[] = [`u.rol = 'representante'`]
    const params: unknown[] = []
    if (!includeInactive) where.push('u.activo = 1')
    if (search) {
      where.push('(u.nombre LIKE ? OR u.apellido LIKE ? OR u.cedula LIKE ? OR IFNULL(u.email, \'\') LIKE ? OR IFNULL(u.whatsapp, \'\') LIKE ?)')
      const like = `%${search}%`
      params.push(like, like, like, like, like)
    }
    const whereSql = `WHERE ${where.join(' AND ')}`

    const rows = await d1Query<{
      id: string
      cedula: string
      nombre: string
      apellido: string
      email: string | null
      telefono: string | null
      whatsapp: string | null
      activo: number
      createdAt: string
      studentsCount: number
    }>(
      `SELECT u.id, u.cedula, u.nombre, u.apellido, u.email, u.telefono, u.whatsapp, u.activo, u.createdAt,
              (SELECT COUNT(*) FROM v3_parent_student ps WHERE ps.representanteId = u.id) AS studentsCount
       FROM v3_users u
       ${whereSql}
       ORDER BY u.apellido ASC, u.nombre ASC`,
      params
    )

    const data = rows.map((r) => ({
      id: r.id,
      cedula: r.cedula,
      nombre: r.nombre,
      apellido: r.apellido,
      email: r.email,
      telefono: r.telefono,
      whatsapp: r.whatsapp,
      activo: r.activo === 1,
      createdAt: r.createdAt,
      studentsCount: Number(r.studentsCount) || 0,
    }))

    return NextResponse.json({ data })
  }

  // Desarrollo: Prisma
  const where: any = { rol: 'representante' }
  if (!includeInactive) where.activo = true
  if (search) {
    where.OR = [
      { nombre: { contains: search } },
      { apellido: { contains: search } },
      { cedula: { contains: search } },
      { email: { contains: search } },
      { whatsapp: { contains: search } },
    ]
  }

  const representantes = await db.user.findMany({
    where,
    select: {
      id: true,
      cedula: true,
      nombre: true,
      apellido: true,
      email: true,
      telefono: true,
      whatsapp: true,
      activo: true,
      createdAt: true,
      _count: { select: { parentLinks: true } },
    },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  })

  const data = representantes.map((r) => ({
    id: r.id,
    cedula: r.cedula,
    nombre: r.nombre,
    apellido: r.apellido,
    email: r.email,
    telefono: r.telefono,
    whatsapp: r.whatsapp,
    activo: r.activo,
    createdAt: r.createdAt,
    studentsCount: r._count.parentLinks,
  }))

  return NextResponse.json({ data })
}

// POST /api/admin/representantes — create a new representante (rol='representante')
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { cedula, nombre, apellido, email, password, telefono, whatsapp } = body

    if (!cedula || !nombre || !apellido || !password) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (cedula, nombre, apellido, password)' },
        { status: 400 }
      )
    }

    if (isD1()) {
      // Producción: D1
      const existingCedula = await d1First<{ id: string }>(
        'SELECT id FROM v3_users WHERE cedula = ? LIMIT 1',
        [cedula]
      )
      if (existingCedula) {
        return NextResponse.json({ error: 'La cédula ya está registrada' }, { status: 409 })
      }

      if (email) {
        const existingEmail = await d1First<{ id: string }>(
          'SELECT id FROM v3_users WHERE email = ? LIMIT 1',
          [email]
        )
        if (existingEmail) {
          return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })
        }
      }

      const hashedPassword = await hashPassword(password)
      const newId = uuidv4()
      const now = new Date().toISOString()
      await d1Run(
        `INSERT INTO v3_users (id, cedula, nombre, apellido, email, password, rol, telefono, whatsapp, fotoKey, activo, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 'representante', ?, ?, NULL, 1, ?, ?)`,
        [newId, cedula, nombre, apellido, email || null, hashedPassword, telefono || null, whatsapp || null, now, now]
      )

      const created = await d1First<{
        id: string
        cedula: string
        nombre: string
        apellido: string
        email: string | null
        rol: string
        telefono: string | null
        whatsapp: string | null
        activo: number
        createdAt: string
      }>(
        'SELECT id, cedula, nombre, apellido, email, rol, telefono, whatsapp, activo, createdAt FROM v3_users WHERE id = ? LIMIT 1',
        [newId]
      )

      return NextResponse.json(
        {
          id: created?.id,
          cedula: created?.cedula,
          nombre: created?.nombre,
          apellido: created?.apellido,
          email: created?.email,
          rol: created?.rol,
          telefono: created?.telefono,
          whatsapp: created?.whatsapp,
          activo: created?.activo === 1,
          createdAt: created?.createdAt,
        },
        { status: 201 }
      )
    }

    // Desarrollo: Prisma
    const existingCedula = await db.user.findUnique({ where: { cedula } })
    if (existingCedula) {
      return NextResponse.json({ error: 'La cédula ya está registrada' }, { status: 409 })
    }

    if (email) {
      const existingEmail = await db.user.findUnique({ where: { email } })
      if (existingEmail) {
        return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })
      }
    }

    const hashedPassword = await hashPassword(password)

    const newUser = await db.user.create({
      data: {
        cedula,
        nombre,
        apellido,
        email: email || null,
        password: hashedPassword,
        rol: 'representante',
        telefono: telefono || null,
        whatsapp: whatsapp || null,
      },
      select: {
        id: true,
        cedula: true,
        nombre: true,
        apellido: true,
        email: true,
        rol: true,
        telefono: true,
        whatsapp: true,
        activo: true,
        createdAt: true,
      },
    })

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error('Create representante error:', error)
    return NextResponse.json({ error: 'Error al crear representante' }, { status: 500 })
  }
}
