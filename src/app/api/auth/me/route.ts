import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// GET /api/auth/me — devuelve el usuario autenticado
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const token = authHeader.substring(7)
  const payload = verifyToken(token)

  if (!payload) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const user = await db.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      cedula: true,
      rol: true,
      nombre: true,
      apellido: true,
      email: true,
      telefono: true,
      activo: true,
    },
  })

  if (!user || !user.activo) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ user })
}
