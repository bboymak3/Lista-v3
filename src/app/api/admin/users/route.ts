import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Query, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { hashPassword } from '@/lib/db-auth'
import { v4 as uuidv4 } from 'uuid'

// GET /api/admin/users — list users, filter by rol
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const rol = searchParams.get('rol') || undefined
  const includeInactive = searchParams.get('includeInactive') === 'true'
  const search = searchParams.get('search') || undefined

  if (isD1()) {
    // Producción: D1
    const where: string[] = []
    const params: unknown[] = []
    if (!includeInactive) where.push('activo = 1')
    if (rol) {
      where.push('rol = ?')
      params.push(rol)
    }
    if (search) {
      where.push('(nombre LIKE ? OR apellido LIKE ? OR cedula LIKE ? OR IFNULL(email, \'\') LIKE ?)')
      const like = `%${search}%`
      params.push(like, like, like, like)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const rows = await d1Query<{
      id: string
      cedula: string
      nombre: string
      apellido: string
      email: string | null
      rol: string
      telefono: string | null
      fotoKey: string | null
      activo: number
      createdAt: string
    }>(
      `SELECT id, cedula, nombre, apellido, email, rol, telefono, fotoKey, activo, createdAt
       FROM v3_users
       ${whereSql}
       ORDER BY rol ASC, apellido ASC`,
      params
    )

    const users = rows.map((u) => ({
      id: u.id,
      cedula: u.cedula,
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      rol: u.rol,
      telefono: u.telefono,
      fotoKey: u.fotoKey,
      activo: u.activo === 1,
      createdAt: u.createdAt,
    }))

    return NextResponse.json({ data: users })
  }

  // Desarrollo: Prisma
  const where: any = {}
  if (!includeInactive) where.activo = true
  if (rol) where.rol = rol
  if (search) {
    where.OR = [
      { nombre: { contains: search } },
      { apellido: { contains: search } },
      { cedula: { contains: search } },
      { email: { contains: search } },
    ]
  }

  const users = await db.user.findMany({
    where,
    select: {
      id: true,
      cedula: true,
      nombre: true,
      apellido: true,
      email: true,
      rol: true,
      telefono: true,
      fotoKey: true,
      activo: true,
      createdAt: true,
    },
    orderBy: [{ rol: 'asc' }, { apellido: 'asc' }],
  })

  return NextResponse.json({ data: users })
}

// POST /api/admin/users — create user
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { cedula, nombre, apellido, email, password, rol, telefono } = body

    if (!cedula || !nombre || !apellido || !password || !rol) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (cedula, nombre, apellido, password, rol)' },
        { status: 400 }
      )
    }

    const validRoles = ['admin', 'profesor', 'representante', 'alumno']
    if (!validRoles.includes(rol)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
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
        `INSERT INTO v3_users (id, cedula, nombre, apellido, email, password, rol, telefono, fotoKey, activo, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)`,
        [newId, cedula, nombre, apellido, email || null, hashedPassword, rol, telefono || null, now, now]
      )

      const created = await d1First<{
        id: string
        cedula: string
        nombre: string
        apellido: string
        email: string | null
        rol: string
        telefono: string | null
        activo: number
        createdAt: string
      }>(
        'SELECT id, cedula, nombre, apellido, email, rol, telefono, activo, createdAt FROM v3_users WHERE id = ? LIMIT 1',
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
          activo: created?.activo === 1,
          createdAt: created?.createdAt,
        },
        { status: 201 }
      )
    }

    // Desarrollo: Prisma
    // Verificar unicidad de cédula
    const existingCedula = await db.user.findUnique({ where: { cedula } })
    if (existingCedula) {
      return NextResponse.json({ error: 'La cédula ya está registrada' }, { status: 409 })
    }

    // Verificar unicidad de email si viene
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
        rol,
        telefono: telefono || null,
      },
      select: {
        id: true,
        cedula: true,
        nombre: true,
        apellido: true,
        email: true,
        rol: true,
        telefono: true,
        activo: true,
        createdAt: true,
      },
    })

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 })
  }
}
