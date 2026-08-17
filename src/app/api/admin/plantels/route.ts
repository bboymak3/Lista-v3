import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1Query, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { getUserPlantelId } from '@/lib/auth-helpers'
import { v4 as uuidv4 } from 'uuid'

// GET /api/admin/plantels — list plantels
// - admin: only their plantel
// - super_admin: all plantels (with counts)
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || (user.rol !== 'admin' && user.rol !== 'super_admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const isSuperAdmin = user.rol === 'super_admin'

  // For super_admin, optionally filter by ?plantelId=
  const { searchParams } = new URL(request.url)
  const queryPlantelId = searchParams.get('plantelId') || undefined

  // For admin role, get their plantelId from DB
  const userPlantelId = isSuperAdmin ? null : await getUserPlantelId(request)
  if (!isSuperAdmin && !userPlantelId) {
    return NextResponse.json({ data: [] })
  }

  if (isD1()) {
    // Producción: D1
    const where: string[] = []
    const params: unknown[] = []

    if (isSuperAdmin) {
      if (queryPlantelId) {
        where.push('p.id = ?')
        params.push(queryPlantelId)
      }
    } else {
      where.push('p.id = ?')
      params.push(userPlantelId)
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const rows = await d1Query<{
      id: string
      nombre: string
      descripcion: string | null
      direccion: string | null
      telefono: string | null
      email: string | null
      lat: number
      lng: number
      radioM: number
      poligonoJson: string | null
      logoKey: string | null
      periodoActual: string
      activo: number
      sectionCount: number
    }>(
      `SELECT p.id, p.nombre, p.descripcion, p.direccion, p.telefono, p.email,
              p.lat, p.lng, p.radioM, p.poligonoJson, p.logoKey, p.periodoActual, p.activo,
              (SELECT COUNT(*) FROM v3_sections s WHERE s.plantelId = p.id) AS sectionCount
       FROM v3_plantels p
       ${whereSql}
       ORDER BY p.activo DESC, p.nombre ASC`,
      params
    )

    const result = rows.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      direccion: p.direccion,
      telefono: p.telefono,
      email: p.email,
      lat: p.lat,
      lng: p.lng,
      radioM: p.radioM,
      poligonoJson: p.poligonoJson,
      logoKey: p.logoKey,
      periodoActual: p.periodoActual,
      activo: p.activo === 1,
      sectionCount: p.sectionCount,
    }))

    return NextResponse.json({ data: result })
  }

  // Desarrollo: Prisma
  const where: any = {}
  if (isSuperAdmin) {
    if (queryPlantelId) where.id = queryPlantelId
  } else {
    where.id = userPlantelId as string
  }

  const plantels = await db.plantel.findMany({
    where,
    include: {
      _count: { select: { sections: true } },
    },
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
  })

  const result = plantels.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    direccion: p.direccion,
    telefono: p.telefono,
    email: p.email,
    lat: p.lat,
    lng: p.lng,
    radioM: p.radioM,
    poligonoJson: p.poligonoJson,
    logoKey: p.logoKey,
    periodoActual: p.periodoActual,
    activo: p.activo,
    sectionCount: p._count.sections,
  }))

  return NextResponse.json({ data: result })
}

// POST /api/admin/plantels — create plantel (only super_admin)
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const {
      nombre,
      descripcion,
      direccion,
      telefono,
      email,
      lat,
      lng,
      radioM,
      logoKey,
    } = body

    if (!nombre || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (nombre, lat, lng)' },
        { status: 400 }
      )
    }

    if (isD1()) {
      // Verificar unicidad de email si viene
      if (email) {
        const existingEmail = await d1First<{ id: string }>(
          'SELECT id FROM v3_plantels WHERE email = ? LIMIT 1',
          [email]
        )
        if (existingEmail) {
          return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })
        }
      }

      const newId = uuidv4()
      const now = new Date().toISOString()
      await d1Run(
        `INSERT INTO v3_plantels (id, nombre, descripcion, direccion, telefono, email, lat, lng, radioM, poligonoJson, logoKey, periodoActual, activo, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 1, ?, ?)`,
        [
          newId,
          nombre,
          descripcion || null,
          direccion || null,
          telefono || null,
          email || null,
          Number(lat),
          Number(lng),
          radioM ? Number(radioM) : 150,
          logoKey || null,
          '2024-2025',
          now,
          now,
        ]
      )

      const created = await d1First<{
        id: string
        nombre: string
        descripcion: string | null
        direccion: string | null
        telefono: string | null
        email: string | null
        lat: number
        lng: number
        radioM: number
        logoKey: string | null
        periodoActual: string
        activo: number
      }>(
        `SELECT id, nombre, descripcion, direccion, telefono, email, lat, lng, radioM, logoKey, periodoActual, activo
         FROM v3_plantels WHERE id = ? LIMIT 1`,
        [newId]
      )

      return NextResponse.json(
        {
          id: created?.id,
          nombre: created?.nombre,
          descripcion: created?.descripcion,
          direccion: created?.direccion,
          telefono: created?.telefono,
          email: created?.email,
          lat: created?.lat,
          lng: created?.lng,
          radioM: created?.radioM,
          logoKey: created?.logoKey,
          periodoActual: created?.periodoActual,
          activo: created?.activo === 1,
        },
        { status: 201 }
      )
    }

    // Desarrollo: Prisma
    const plantel = await db.plantel.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        direccion: direccion || null,
        telefono: telefono || null,
        email: email || null,
        lat: Number(lat),
        lng: Number(lng),
        radioM: radioM ? Number(radioM) : 150,
        logoKey: logoKey || null,
      },
    })

    return NextResponse.json(plantel, { status: 201 })
  } catch (error) {
    console.error('Create plantel error:', error)
    return NextResponse.json({ error: 'Error al crear plantel' }, { status: 500 })
  }
}
