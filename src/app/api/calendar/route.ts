import { NextRequest, NextResponse } from 'next/server'
import { isD1, d1Query } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/calendar?plantelId=xxx&month=YYYY-MM
// Público para profesores/representantes/alumnos ver el calendario
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const plantelId = searchParams.get('plantelId')
  if (!plantelId) return NextResponse.json({ error: 'plantelId requerido' }, { status: 400 })

  if (isD1()) {
    const events = await d1Query(
      `SELECT * FROM v3_calendar_events WHERE plantelId = ? ORDER BY fecha ASC`,
      [plantelId]
    )
    return NextResponse.json({ events: events.map((e: any) => ({ ...e, afectaAsistencia: e.afectaAsistencia === 1 })) })
  }

  const { db } = await import('@/lib/db-dev')
  const events = await db.calendarEvent.findMany({ where: { plantelId }, orderBy: { fecha: 'asc' } })
  return NextResponse.json({ events })
}
