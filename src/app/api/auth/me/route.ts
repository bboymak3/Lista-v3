import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First } from '@/lib/d1'
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

  let user: any = null

  if (isD1()) {
    // Producción: D1 crudo
    user = await d1First<{
      id: string
      cedula: string
      rol: string
      nombre: string
      apellido: string
      email: string | null
      telefono: string | null
      whatsapp: string | null
      activo: number
    }>(
      'SELECT id, cedula, rol, nombre, apellido, email, telefono, whatsapp, activo FROM v3_users WHERE id = ? LIMIT 1',
      [payload.id]
    )
    // Normalizar booleano
    if (user) user.activo = user.activo === 1
  } else {
    // Desarrollo: Prisma
    user = await db.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        cedula: true,
        rol: true,
        nombre: true,
        apellido: true,
        email: true,
        telefono: true,
        whatsapp: true,
        activo: true,
      },
    })
  }

  if (!user || !user.activo) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ user })
}
