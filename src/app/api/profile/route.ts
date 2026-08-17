import { NextRequest, NextResponse } from 'next/server'
import { isD1, d1First, d1Run } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/profile — datos del usuario autenticado
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (isD1()) {
    const profile = await d1First<{
      id: string; cedula: string; nombre: string; apellido: string;
      email: string | null; telefono: string | null; whatsapp: string | null;
      fotoKey: string | null; rol: string; plantelId: string | null
    }>(
      `SELECT id, cedula, nombre, apellido, email, telefono, whatsapp, fotoKey, rol, plantelId
       FROM v3_users WHERE id = ? LIMIT 1`,
      [user.id]
    )
    if (!profile) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ profile })
  }

  const { db } = await import('@/lib/db-dev')
  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, cedula: true, nombre: true, apellido: true, email: true, telefono: true, whatsapp: true, fotoKey: true, rol: true, plantelId: true }
  })
  return NextResponse.json({ profile })
}

// PUT /api/profile — actualizar perfil propio (con reglas por rol)
export async function PUT(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Alumno no puede editar su perfil
  if (user.rol === 'alumno') {
    return NextResponse.json({ error: 'No puedes editar tu perfil. Contacta a la dirección.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))

  // Campos editables según rol
  const editable: Record<string, boolean> = {
    cedula: user.rol === 'super_admin',
    nombre: user.rol === 'super_admin' || user.rol === 'admin',
    apellido: user.rol === 'super_admin' || user.rol === 'admin',
    email: user.rol === 'super_admin' || user.rol === 'admin',
    telefono: true,
    whatsapp: true,
    fotoKey: true,
  }

  const data: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (editable[k] && v !== undefined) {
      if (k === 'whatsapp' && v) {
        const digits = String(v).replace(/\D/g, '')
        if (digits.length < 8 || digits.length > 15) {
          return NextResponse.json({ error: 'WhatsApp debe tener 8-15 dígitos' }, { status: 400 })
        }
        data[k] = digits
      } else {
        data[k] = v
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Sin cambios para aplicar' }, { status: 400 })
  }

  if (isD1()) {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ')
    const values = Object.values(data)
    await d1Run(`UPDATE v3_users SET ${sets} WHERE id = ?`, [...values, user.id])
    const profile = await d1First(
      `SELECT id, cedula, nombre, apellido, email, telefono, whatsapp, fotoKey, rol, plantelId FROM v3_users WHERE id = ?`,
      [user.id]
    )
    return NextResponse.json({ profile })
  }

  const { db } = await import('@/lib/db-dev')
  await db.user.update({ where: { id: user.id }, data })
  const profile = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, cedula: true, nombre: true, apellido: true, email: true, telefono: true, whatsapp: true, fotoKey: true, rol: true, plantelId: true }
  })
  return NextResponse.json({ profile })
}
