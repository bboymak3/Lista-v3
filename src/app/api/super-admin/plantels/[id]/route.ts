import { NextRequest, NextResponse } from 'next/server'
import { isD1, d1First, d1Run } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/super-admin/plantels/[id] — detalle de un liceo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const { id } = await params

  if (isD1()) {
    const plantel = await d1First(`SELECT * FROM v3_plantels WHERE id = ?`, [id])
    if (!plantel) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ plantel: { ...plantel, activo: plantel.activo === 1 } })
  }

  const { db } = await import('@/lib/db-dev')
  const plantel = await db.plantel.findUnique({ where: { id } })
  if (!plantel) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json({ plantel: { ...plantel, activo: Boolean(plantel.activo) } })
}

// PUT /api/super-admin/plantels/[id] — actualizar liceo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json()

  const allowed = ['nombre', 'descripcion', 'direccion', 'telefono', 'email', 'lat', 'lng', 'radioM', 'logoKey', 'periodoActual', 'activo']
  const data: Record<string, unknown> = {}
  for (const k of allowed) {
    if (body[k] !== undefined) {
      data[k] = k === 'activo' ? (body[k] ? 1 : 0) : body[k]
    }
  }

  if (isD1()) {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ')
    if (sets) await d1Run(`UPDATE v3_plantels SET ${sets} WHERE id = ?`, [...Object.values(data), id])
    const plantel = await d1First(`SELECT * FROM v3_plantels WHERE id = ?`, [id])
    return NextResponse.json({ plantel: { ...plantel, activo: plantel.activo === 1 } })
  }

  const { db } = await import('@/lib/db-dev')
  const plantel = await db.plantel.update({ where: { id }, data: { ...data, activo: data.activo as boolean | undefined } as any })
  return NextResponse.json({ plantel: { ...plantel, activo: Boolean(plantel.activo) } })
}

// DELETE /api/super-admin/plantels/[id] — soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const { id } = await params

  if (isD1()) {
    await d1Run('UPDATE v3_plantels SET activo = 0 WHERE id = ?', [id])
  } else {
    const { db } = await import('@/lib/db-dev')
    await db.plantel.update({ where: { id }, data: { activo: false } })
  }
  return NextResponse.json({ ok: true })
}
