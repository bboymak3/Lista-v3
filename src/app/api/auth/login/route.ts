export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'

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

    const user = await db.user.findUnique({
      where: { cedula, activo: true },
      include: {
        studentProfile: { select: { id: true } },
      },
    })

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

    const payload: JwtPayload = {
      id: user.id,
      cedula: user.cedula,
      rol: user.rol,
      nombre: user.nombre,
      apellido: user.apellido,
      estudianteId: user.studentProfile?.id ?? null,
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
        estudianteId: user.studentProfile?.id ?? null,
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
