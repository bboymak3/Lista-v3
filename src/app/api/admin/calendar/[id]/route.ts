import { NextRequest, NextResponse } from 'next/server'
import { isD1, d1Run } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'

// DELETE /api/admin/calendar/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || (user.rol !== 'admin' && user.rol !== 'super_admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params

  if (isD1()) {
    await d1Run('DELETE FROM v3_calendar_events WHERE id = ?', [id])
  } else {
    const { db } = await import('@/lib/db-dev')
    await db.calendarEvent.delete({ where: { id } })
  }
  return NextResponse.json({ ok: true })
}
