export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// PUT /api/admin/plantels/[id] — update plantel (especially geocerca)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { nombre, direccion, lat, lng, radioM, periodoActual, poligonoJson } = body

    const existing = await db.plantel.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Plantel no encontrado' }, { status: 404 })
    }

    const updated = await db.plantel.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(direccion !== undefined && { direccion: direccion || null }),
        ...(lat !== undefined && { lat: Number(lat) }),
        ...(lng !== undefined && { lng: Number(lng) }),
        ...(radioM !== undefined && { radioM: Number(radioM) }),
        ...(periodoActual !== undefined && { periodoActual }),
        ...(poligonoJson !== undefined && { poligonoJson: poligonoJson || null }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update plantel error:', error)
    return NextResponse.json({ error: 'Error al actualizar plantel' }, { status: 500 })
  }
}
