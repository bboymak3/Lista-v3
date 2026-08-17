import { NextRequest, NextResponse } from 'next/server'
import { isD1, d1Query, d1First, d1Run } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

// GET /api/admin/calendar?plantelId=xxx&from=YYYY-MM&to=YYYY-MM
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || (user.rol !== 'admin' && user.rol !== 'super_admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

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

// POST /api/admin/calendar
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || (user.rol !== 'admin' && user.rol !== 'super_admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { plantelId, tipo, titulo, descripcion, fecha, fechaFin, afectaAsistencia } = body

  if (!plantelId || !tipo || !titulo || !fecha) {
    return NextResponse.json({ error: 'plantelId, tipo, titulo y fecha son requeridos' }, { status: 400 })
  }

  const validTipos = ['feriado', 'vacaciones', 'reunion', 'examen', 'otro']
  if (!validTipos.includes(tipo)) {
    return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
  }

  const id = uuidv4()
  if (isD1()) {
    await d1Run(
      `INSERT INTO v3_calendar_events (id, plantelId, tipo, titulo, descripcion, fecha, fechaFin, afectaAsistencia, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, plantelId, tipo, titulo, descripcion || null, fecha, fechaFin || null, afectaAsistencia === false ? 0 : 1]
    )
    const event = await d1First(`SELECT * FROM v3_calendar_events WHERE id = ?`, [id])
    return NextResponse.json({ event: { ...event, afectaAsistencia: event.afectaAsistencia === 1 } }, { status: 201 })
  }

  const { db } = await import('@/lib/db-dev')
  const event = await db.calendarEvent.create({
    data: { id, plantelId, tipo, titulo, descripcion, fecha, fechaFin, afectaAsistencia: afectaAsistencia !== false }
  })
  return NextResponse.json({ event }, { status: 201 })
}
