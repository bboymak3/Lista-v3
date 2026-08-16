import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/representante/profile — devuelve el perfil del representante autenticado
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'representante') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  if (isD1()) {
    // Producción: D1
    const user = await d1First<{
      id: string
      cedula: string
      nombre: string
      apellido: string
      email: string | null
      telefono: string | null
      whatsapp: string | null
    }>(
      'SELECT id, cedula, nombre, apellido, email, telefono, whatsapp FROM v3_users WHERE id = ? LIMIT 1',
      [payload.id]
    )

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ user })
  }

  // Desarrollo: Prisma
  const user = await db.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      cedula: true,
      nombre: true,
      apellido: true,
      email: true,
      telefono: true,
      whatsapp: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ user })
}

// PUT /api/representante/profile — actualiza whatsapp (y opcionalmente telefono)
// Body: { whatsapp?: string, telefono?: string }
export async function PUT(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'representante') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    whatsapp?: string
    telefono?: string
  }

  // Normalizar whatsapp: dígitos únicamente (sin + ni espacios)
  let whatsapp: string | null = null
  if (body.whatsapp !== undefined && body.whatsapp !== null && body.whatsapp !== '') {
    const digits = body.whatsapp.replace(/[^\d]/g, '')
    if (digits.length < 8 || digits.length > 15) {
      return NextResponse.json(
        { error: 'El número de WhatsApp debe tener entre 8 y 15 dígitos' },
        { status: 400 }
      )
    }
    whatsapp = digits
  }

  let telefono: string | null | undefined
  if (body.telefono !== undefined && body.telefono !== null && body.telefono !== '') {
    telefono = body.telefono.trim()
  }

  if (isD1()) {
    // Producción: D1 — build dinámico del UPDATE
    const sets: string[] = []
    const params: unknown[] = []
    if (whatsapp !== undefined) {
      sets.push('whatsapp = ?')
      params.push(whatsapp)
    }
    if (telefono !== undefined) {
      sets.push('telefono = ?')
      params.push(telefono)
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
    }
    params.push(payload.id)
    await d1Run(`UPDATE v3_users SET ${sets.join(', ')} WHERE id = ?`, params)

    const user = await d1First<{
      id: string
      cedula: string
      nombre: string
      apellido: string
      email: string | null
      telefono: string | null
      whatsapp: string | null
    }>(
      'SELECT id, cedula, nombre, apellido, email, telefono, whatsapp FROM v3_users WHERE id = ? LIMIT 1',
      [payload.id]
    )

    return NextResponse.json({ ok: true, user })
  }

  // Desarrollo: Prisma
  const data: { whatsapp?: string | null; telefono?: string | null } = {}
  if (whatsapp !== undefined) data.whatsapp = whatsapp
  if (telefono !== undefined) data.telefono = telefono

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
  }

  await db.user.update({
    where: { id: payload.id },
    data,
  })

  const user = await db.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      cedula: true,
      nombre: true,
      apellido: true,
      email: true,
      telefono: true,
      whatsapp: true,
    },
  })

  return NextResponse.json({ ok: true, user })
}
