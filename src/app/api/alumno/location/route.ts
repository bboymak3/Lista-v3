import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/alumno/location — último LocationPing del alumno
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'alumno') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const student = await db.student.findUnique({
    where: { userId: payload.id },
    select: { id: true },
  })
  if (!student) {
    return NextResponse.json({ error: 'Perfil de estudiante no encontrado' }, { status: 404 })
  }

  const last = await db.locationPing.findFirst({
    where: { estudianteId: student.id },
    orderBy: { timestamp: 'desc' },
  })

  return NextResponse.json({
    ping: last
      ? {
          id: last.id,
          lat: last.lat,
          lng: last.lng,
          precision: last.precision,
          timestamp: last.timestamp,
        }
      : null,
  })
}

// POST /api/alumno/location
// Body: { lat, lng, precision? }
export async function POST(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'alumno') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { lat, lng, precision } = body as { lat?: number; lng?: number; precision?: number }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat y lng son requeridos (números)' }, { status: 400 })
  }

  const student = await db.student.findUnique({
    where: { userId: payload.id },
    select: { id: true },
  })
  if (!student) {
    return NextResponse.json({ error: 'Perfil de estudiante no encontrado' }, { status: 404 })
  }

  const ping = await db.locationPing.create({
    data: {
      estudianteId: student.id,
      lat,
      lng,
      precision: typeof precision === 'number' ? precision : null,
    },
  })

  return NextResponse.json({
    ok: true,
    ping: {
      id: ping.id,
      lat: ping.lat,
      lng: ping.lng,
      precision: ping.precision,
      timestamp: ping.timestamp,
    },
  })
}
