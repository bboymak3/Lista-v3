export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { hashPassword } from '@/lib/db-auth'

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
