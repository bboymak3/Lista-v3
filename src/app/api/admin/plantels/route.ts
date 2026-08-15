export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/admin/plantels — list plantels
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

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
