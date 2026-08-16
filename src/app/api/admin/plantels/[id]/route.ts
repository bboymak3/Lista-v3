import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run } from '@/lib/d1'
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

    if (isD1()) {
      // Producción: D1
      const existing = await d1First<{ id: string }>(
        'SELECT id FROM v3_plantels WHERE id = ? LIMIT 1',
        [id]
      )
      if (!existing) {
        return NextResponse.json({ error: 'Plantel no encontrado' }, { status: 404 })
      }

      const sets: string[] = []
      const sqlParams: unknown[] = []
      if (nombre !== undefined) { sets.push('nombre = ?'); sqlParams.push(nombre) }
      if (direccion !== undefined) { sets.push('direccion = ?'); sqlParams.push(direccion || null) }
      if (lat !== undefined) { sets.push('lat = ?'); sqlParams.push(Number(lat)) }
      if (lng !== undefined) { sets.push('lng = ?'); sqlParams.push(Number(lng)) }
      if (radioM !== undefined) { sets.push('radioM = ?'); sqlParams.push(Number(radioM)) }
      if (periodoActual !== undefined) { sets.push('periodoActual = ?'); sqlParams.push(periodoActual) }
      if (poligonoJson !== undefined) { sets.push('poligonoJson = ?'); sqlParams.push(poligonoJson || null) }
      sets.push('updatedAt = ?')
      sqlParams.push(new Date().toISOString())
      sqlParams.push(id)

      if (sets.length > 1) {
        await d1Run(`UPDATE v3_plantels SET ${sets.join(', ')} WHERE id = ?`, sqlParams)
      }

      const updated = await d1First<{
        id: string
        nombre: string
        direccion: string | null
        lat: number
        lng: number
        radioM: number
        poligonoJson: string | null
        periodoActual: string
      }>(
        'SELECT id, nombre, direccion, lat, lng, radioM, poligonoJson, periodoActual FROM v3_plantels WHERE id = ? LIMIT 1',
        [id]
      )

      return NextResponse.json(updated)
    }

    // Desarrollo: Prisma
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
