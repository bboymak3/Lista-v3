import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Query } from '@/lib/d1'
import { db } from '@/lib/db'
import { verifyPassword, signToken, JwtPayload } from '@/lib/auth'

// POST /api/auth/login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { cedula, password } = body

    if (!cedula || !password) {
      return NextResponse.json(
        { error: 'Cédula y contraseña son requeridas' },
        { status: 400 }
      )
    }

    let user: any = null

    if (isD1()) {
      // Producción: D1 crudo
      user = await d1First<{
        id: string
        cedula: string
        nombre: string
        apellido: string
        email: string
        password: string
        rol: string
        activo: number
      }>('SELECT id, cedula, nombre, apellido, email, password, rol, activo FROM v3_users WHERE cedula = ? AND activo = 1 LIMIT 1', [cedula])
    } else {
      // Desarrollo: Prisma
      user = await db.user.findUnique({
        where: { cedula, activo: true },
        select: { id: true, cedula: true, nombre: true, apellido: true, email: true, password: true, rol: true, activo: true },
      })
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    const valid = await verifyPassword(password, user.password)
    if (!valid) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    // Buscar perfil de estudiante si el rol es alumno
    let estudianteId: string | null = null
    if (user.rol === 'alumno') {
      if (isD1()) {
        const student = await d1First<{ id: string }>('SELECT id FROM v3_students WHERE userId = ? LIMIT 1', [user.id])
        estudianteId = student?.id ?? null
      } else {
        const student = await db.student.findFirst({ where: { userId: user.id }, select: { id: true } })
        estudianteId = student?.id ?? null
      }
    }

    const payload: JwtPayload = {
      id: user.id,
      cedula: user.cedula,
      rol: user.rol,
      nombre: user.nombre,
      apellido: user.apellido,
      estudianteId,
    }

    const token = signToken(payload)

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        cedula: user.cedula,
        rol: user.rol,
        nombre: user.nombre,
        apellido: user.apellido,
        estudianteId,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
