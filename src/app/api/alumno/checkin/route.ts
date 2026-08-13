import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
function endOfToday(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

// Fórmula de Haversine (distancia en metros entre dos puntos geográficos)
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000 // radio de la Tierra en metros
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

// GET /api/alumno/checkin — estado de asistencia de hoy
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
    select: {
      id: true,
      sectionId: true,
      section: {
        select: {
          plantel: { select: { nombre: true, lat: true, lng: true, radioM: true } },
        },
      },
    },
  })
  if (!student) {
    return NextResponse.json({ error: 'Perfil de estudiante no encontrado' }, { status: 404 })
  }

  const today = await db.attendance.findFirst({
    where: {
      estudianteId: student.id,
      fecha: { gte: startOfToday(), lte: endOfToday() },
    },
    orderBy: { fecha: 'desc' },
  })

  return NextResponse.json({
    hoy: today
      ? {
          id: today.id,
          estado: today.estado,
          origen: today.origen,
          lat: today.lat,
          lng: today.lng,
          fecha: today.fecha,
          sessionId: today.sessionId,
        }
      : null,
    plantel: student.section.plantel,
  })
}

// POST /api/alumno/checkin
// Body: { lat, lng }
export async function POST(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'alumno') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { lat, lng } = body as { lat?: number; lng?: number }

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'lat y lng son requeridos (números)' }, { status: 400 })
  }

  const student = await db.student.findUnique({
    where: { userId: payload.id },
    select: {
      id: true,
      sectionId: true,
      section: {
        select: {
          id: true,
          plantel: { select: { id: true, nombre: true, lat: true, lng: true, radioM: true } },
        },
      },
    },
  })
  if (!student) {
    return NextResponse.json({ error: 'Perfil de estudiante no encontrado' }, { status: 404 })
  }

  const plantel = student.section.plantel
  if (!plantel) {
    return NextResponse.json(
      { error: 'Tu sección no tiene plantel asociado' },
      { status: 400 }
    )
  }

  // Verificar geocerca
  const distancia = haversineMeters(lat, lng, plantel.lat, plantel.lng)
  if (distancia > plantel.radioM) {
    return NextResponse.json(
      {
        error: 'Fuera del rango del plantel',
        distancia,
        radioPermitido: plantel.radioM,
        plantelNombre: plantel.nombre,
      },
      { status: 403 }
    )
  }

  // Buscar registro de asistencia de hoy (si existe)
  const existente = await db.attendance.findFirst({
    where: {
      estudianteId: student.id,
      fecha: { gte: startOfToday(), lte: endOfToday() },
    },
    orderBy: { fecha: 'desc' },
  })

  // Si ya hay un Attendance de hoy del propio alumno (origen=gps_auto y estado=presente),
  // devolverlo idempotente. Si existe pero fue marcado por el profesor (ausente, etc.),
  // el GPS check-in lo sobrescribe a presente.
  if (existente) {
    if (existente.origen === 'gps_auto' && existente.estado === 'presente') {
      return NextResponse.json({
        ok: true,
        yaExistente: true,
        message: 'Check-in registrado: Presente',
        asistencia: {
          id: existente.id,
          estado: existente.estado,
          origen: existente.origen,
          lat: existente.lat,
          lng: existente.lng,
          fecha: existente.fecha,
          sessionId: existente.sessionId,
        },
        distancia,
        radioPermitido: plantel.radioM,
      })
    }

    // Sobrescribir registro existente (ej. profesor marcó ausente y el alumno
    // demuestra presencia física en el plantel con GPS)
    const updated = await db.attendance.update({
      where: { id: existente.id },
      data: {
        estado: 'presente',
        origen: 'gps_auto',
        lat,
        lng,
        marcadoPor: payload.id,
        fecha: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      yaExistente: false,
      message: 'Check-in registrado: Presente',
      asistencia: {
        id: updated.id,
        estado: updated.estado,
        origen: updated.origen,
        lat: updated.lat,
        lng: updated.lng,
        fecha: updated.fecha,
        sessionId: updated.sessionId,
      },
      session: existente.sessionId
        ? { id: existente.sessionId }
        : null,
      distancia,
      radioPermitido: plantel.radioM,
    })
  }

  // Buscar sesión activa de hoy para la sección del alumno
  const session = await db.attendanceSession.findFirst({
    where: {
      sectionId: student.sectionId,
      fecha: { gte: startOfToday(), lte: endOfToday() },
      estado: 'activa',
    },
    orderBy: { fecha: 'desc' },
  })

  // Crear el registro de asistencia (con o sin sesión)
  const asistencia = await db.attendance.create({
    data: {
      estudianteId: student.id,
      sessionId: session?.id ?? null,
      estado: 'presente',
      origen: 'gps_auto',
      lat,
      lng,
      marcadoPor: payload.id,
    },
  })

  return NextResponse.json({
    ok: true,
    yaExistente: false,
    message: 'Check-in registrado: Presente',
    asistencia: {
      id: asistencia.id,
      estado: asistencia.estado,
      origen: asistencia.origen,
      lat: asistencia.lat,
      lng: asistencia.lng,
      fecha: asistencia.fecha,
      sessionId: asistencia.sessionId,
    },
    session: session ? { id: session.id, estado: session.estado } : null,
    distancia,
    radioPermitido: plantel.radioM,
  })
}
