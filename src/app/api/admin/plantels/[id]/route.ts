import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { getUserPlantelId } from '@/lib/auth-helpers'

// PUT /api/admin/plantels/[id] — update plantel
// - super_admin: can edit any plantel (incl. descripcion, telefono, email, logoKey, activo)
// - admin: can only edit their own plantel (limited fields: nombre, direccion, lat, lng, radioM, periodoActual, poligonoJson)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || (user.rol !== 'admin' && user.rol !== 'super_admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const { id } = await params
    const isSuperAdmin = user.rol === 'super_admin'

    // Para admin: validar que el plantel le pertenece
    if (!isSuperAdmin) {
      const userPlantelId = await getUserPlantelId(request)
      if (userPlantelId !== id) {
        return NextResponse.json({ error: 'No autorizado para este plantel' }, { status: 403 })
      }
    }

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
      periodoActual,
      poligonoJson,
      logoKey,
      activo,
    } = body

    if (isD1()) {
      // Producción: D1
      const existing = await d1First<{ id: string; email: string | null }>(
        'SELECT id, email FROM v3_plantels WHERE id = ? LIMIT 1',
        [id]
      )
      if (!existing) {
        return NextResponse.json({ error: 'Plantel no encontrado' }, { status: 404 })
      }

      // Verificar unicidad de email si cambia
      if (email && email !== existing.email) {
        const dup = await d1First<{ id: string }>(
          'SELECT id FROM v3_plantels WHERE email = ? AND id != ? LIMIT 1',
          [email, id]
        )
        if (dup) {
          return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })
        }
      }

      const sets: string[] = []
      const sqlParams: unknown[] = []
      // Campos comunes (ambos roles pueden editar)
      if (nombre !== undefined) { sets.push('nombre = ?'); sqlParams.push(nombre) }
      if (direccion !== undefined) { sets.push('direccion = ?'); sqlParams.push(direccion || null) }
      if (lat !== undefined) { sets.push('lat = ?'); sqlParams.push(Number(lat)) }
      if (lng !== undefined) { sets.push('lng = ?'); sqlParams.push(Number(lng)) }
      if (radioM !== undefined) { sets.push('radioM = ?'); sqlParams.push(Number(radioM)) }
      if (periodoActual !== undefined) { sets.push('periodoActual = ?'); sqlParams.push(periodoActual) }
      if (poligonoJson !== undefined) { sets.push('poligonoJson = ?'); sqlParams.push(poligonoJson || null) }

      // Campos exclusivos super_admin
      if (isSuperAdmin) {
        if (descripcion !== undefined) { sets.push('descripcion = ?'); sqlParams.push(descripcion || null) }
        if (telefono !== undefined) { sets.push('telefono = ?'); sqlParams.push(telefono || null) }
        if (email !== undefined) { sets.push('email = ?'); sqlParams.push(email || null) }
        if (logoKey !== undefined) { sets.push('logoKey = ?'); sqlParams.push(logoKey || null) }
        if (activo !== undefined) { sets.push('activo = ?'); sqlParams.push(activo ? 1 : 0) }
      }

      sets.push('updatedAt = ?')
      sqlParams.push(new Date().toISOString())
      sqlParams.push(id)

      if (sets.length > 1) {
        await d1Run(`UPDATE v3_plantels SET ${sets.join(', ')} WHERE id = ?`, sqlParams)
      }

      const updated = await d1First<{
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
      }>(
        'SELECT id, nombre, descripcion, direccion, telefono, email, lat, lng, radioM, poligonoJson, logoKey, periodoActual, activo FROM v3_plantels WHERE id = ? LIMIT 1',
        [id]
      )

      return NextResponse.json({
        id: updated?.id,
        nombre: updated?.nombre,
        descripcion: updated?.descripcion,
        direccion: updated?.direccion,
        telefono: updated?.telefono,
        email: updated?.email,
        lat: updated?.lat,
        lng: updated?.lng,
        radioM: updated?.radioM,
        poligonoJson: updated?.poligonoJson,
        logoKey: updated?.logoKey,
        periodoActual: updated?.periodoActual,
        activo: updated?.activo === 1,
      })
    }

    // Desarrollo: Prisma
    const existing = await db.plantel.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Plantel no encontrado' }, { status: 404 })
    }

    const data: any = {
      ...(nombre !== undefined && { nombre }),
      ...(direccion !== undefined && { direccion: direccion || null }),
      ...(lat !== undefined && { lat: Number(lat) }),
      ...(lng !== undefined && { lng: Number(lng) }),
      ...(radioM !== undefined && { radioM: Number(radioM) }),
      ...(periodoActual !== undefined && { periodoActual }),
      ...(poligonoJson !== undefined && { poligonoJson: poligonoJson || null }),
    }

    if (isSuperAdmin) {
      if (descripcion !== undefined) data.descripcion = descripcion || null
      if (telefono !== undefined) data.telefono = telefono || null
      if (email !== undefined) data.email = email || null
      if (logoKey !== undefined) data.logoKey = logoKey || null
      if (activo !== undefined) data.activo = activo
    }

    const updated = await db.plantel.update({
      where: { id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update plantel error:', error)
    return NextResponse.json({ error: 'Error al actualizar plantel' }, { status: 500 })
  }
}

// DELETE /api/admin/plantels/[id] — soft delete (solo super_admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const { id } = await params

    if (isD1()) {
      const existing = await d1First<{ id: string }>(
        'SELECT id FROM v3_plantels WHERE id = ? LIMIT 1',
        [id]
      )
      if (!existing) {
        return NextResponse.json({ error: 'Plantel no encontrado' }, { status: 404 })
      }
      await d1Run('UPDATE v3_plantels SET activo = 0, updatedAt = ? WHERE id = ?', [
        new Date().toISOString(),
        id,
      ])
      return NextResponse.json({ success: true })
    }

    const existing = await db.plantel.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Plantel no encontrado' }, { status: 404 })
    }
    await db.plantel.update({ where: { id }, data: { activo: false } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete plantel error:', error)
    return NextResponse.json({ error: 'Error al eliminar plantel' }, { status: 500 })
  }
}
