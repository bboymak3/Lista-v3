import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// DELETE /api/representante/justifications/[id]
// Cancela una justificación pendiente del representante.
// Solo se permite cancelar si estado='pendiente' y pertenece al representante.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'representante') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  }

  if (isD1()) {
    // Producción: D1 crudo
    const just = await d1First<{ id: string; estado: string; representanteId: string }>(
      'SELECT id, estado, representanteId FROM v3_justifications WHERE id = ? LIMIT 1',
      [id]
    )

    if (!just) {
      return NextResponse.json(
        { error: 'Justificación no encontrada' },
        { status: 404 }
      )
    }
    if (just.representanteId !== payload.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (just.estado !== 'pendiente') {
      return NextResponse.json(
        { error: 'Solo se pueden cancelar justificaciones pendientes' },
        { status: 400 }
      )
    }

    await d1Run('DELETE FROM v3_justifications WHERE id = ?', [id])
    return NextResponse.json({ ok: true })
  }

  // Desarrollo: Prisma
  const just = await db.justification.findUnique({
    where: { id },
    select: { id: true, estado: true, representanteId: true },
  })

  if (!just) {
    return NextResponse.json(
      { error: 'Justificación no encontrada' },
      { status: 404 }
    )
  }
  if (just.representanteId !== payload.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (just.estado !== 'pendiente') {
    return NextResponse.json(
      { error: 'Solo se pueden cancelar justificaciones pendientes' },
      { status: 400 }
    )
  }

  await db.justification.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
