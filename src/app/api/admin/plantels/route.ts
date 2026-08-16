import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1Query, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

// GET /api/admin/plantels — list plantels
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (isD1()) {
    // Producción: D1
    const rows = await d1Query<{
      id: string
      nombre: string
      direccion: string | null
      lat: number
      lng: number
      radioM: number
      poligonoJson: string | null
      periodoActual: string
      sectionCount: number
    }>(
      `SELECT p.id, p.nombre, p.direccion, p.lat, p.lng, p.radioM, p.poligonoJson, p.periodoActual,
              (SELECT COUNT(*) FROM v3_sections s WHERE s.plantelId = p.id) AS sectionCount
       FROM v3_plantels p
       ORDER BY p.nombre ASC`
    )

    const result = rows.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      direccion: p.direccion,
      lat: p.lat,
      lng: p.lng,
      radioM: p.radioM,
      poligonoJson: p.poligonoJson,
      periodoActual: p.periodoActual,
      sectionCount: p.sectionCount,
    }))

    return NextResponse.json({ data: result })
  }

  // Desarrollo: Prisma
  const plantels = await db.plantel.findMany({
    include: {
      _count: { select: { sections: true } },
    },
    orderBy: { nombre: 'asc' },
  })

  const result = plantels.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    direccion: p.direccion,
    lat: p.lat,
    lng: p.lng,
    radioM: p.radioM,
    poligonoJson: p.poligonoJson,
    periodoActual: p.periodoActual,
    sectionCount: p._count.sections,
  }))

  return NextResponse.json({ data: result })
}

// POST /api/admin/plantels — create plantel
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { nombre, direccion, lat, lng, radioM } = body

    if (!nombre || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (nombre, lat, lng)' },
        { status: 400 }
      )
    }

    if (isD1()) {
      // Producción: D1
      const newId = uuidv4()
      const now = new Date().toISOString()
      await d1Run(
        `INSERT INTO v3_plantels (id, nombre, direccion, lat, lng, radioM, poligonoJson, periodoActual, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
        [
          newId,
          nombre,
          direccion || null,
          Number(lat),
          Number(lng),
          radioM ? Number(radioM) : 150,
          '2024-2025',
          now,
          now,
        ]
      )

      const created = await d1First<{
        id: string
        nombre: string
        direccion: string | null
        lat: number
        lng: number
        radioM: number
        poligonoJson: string | null
        periodoActual: string
      }>('SELECT id, nombre, direccion, lat, lng, radioM, poligonoJson, periodoActual FROM v3_plantels WHERE id = ? LIMIT 1', [newId])

      return NextResponse.json(created, { status: 201 })
    }

    // Desarrollo: Prisma
    const plantel = await db.plantel.create({
      data: {
        nombre,
        direccion: direccion || null,
        lat: Number(lat),
        lng: Number(lng),
        radioM: radioM ? Number(radioM) : 150,
      },
    })

    return NextResponse.json(plantel, { status: 201 })
  } catch (error) {
    console.error('Create plantel error:', error)
    return NextResponse.json({ error: 'Error al crear plantel' }, { status: 500 })
  }
}


