import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run, d1Query } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

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

// GET /api/alumno/checkin — estado VISUAL del alumno (no crea asistencia)
// Muestra: última ubicación registrada + si está dentro de la geocerca + asistencia que el profesor haya marcado
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'alumno') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  if (isD1()) {
    // Producción: D1
    const student = await d1First<{
      id: string
      sectionId: string
      plantelNombre: string
      plantelLat: number
      plantelLng: number
      plantelRadioM: number
    }>(
      `SELECT st.id, st.sectionId,
              p.nombre AS plantelNombre, p.lat AS plantelLat, p.lng AS plantelLng, p.radioM AS plantelRadioM
       FROM v3_students st
       INNER JOIN v3_sections s ON s.id = st.sectionId
       LEFT JOIN v3_plantels p ON p.id = s.plantelId
       WHERE st.userId = ? LIMIT 1`,
      [payload.id]
    )
    if (!student) {
      return NextResponse.json({ error: 'Perfil de estudiante no encontrado' }, { status: 404 })
    }

    // Última ubicación reportada (solo visual)
    const lastPing = await d1First<{
      id: string
      lat: number
      lng: number
      timestamp: string
    }>(
      `SELECT id, lat, lng, timestamp
       FROM v3_location_pings
       WHERE estudianteId = ?
       ORDER BY timestamp DESC
       LIMIT 1`,
      [student.id]
    )

    return NextResponse.json({
      // Asistencia marcada por el profesor (read-only, el alumno no la cambia)
      plantel: {
        nombre: student.plantelNombre,
        lat: student.plantelLat,
        lng: student.plantelLng,
        radioM: student.plantelRadioM,
      },
      lastPing: lastPing
        ? {
            lat: lastPing.lat,
            lng: lastPing.lng,
            timestamp: lastPing.timestamp,
          }
        : null,
    })
  }

  // Desarrollo: Prisma
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

  const lastPing = await db.locationPing.findFirst({
    where: { estudianteId: student.id },
    orderBy: { timestamp: 'desc' },
    select: { lat: true, lng: true, timestamp: true },
  })

  return NextResponse.json({
    plantel: student.section.plantel,
    lastPing: lastPing
      ? {
          lat: lastPing.lat,
          lng: lastPing.lng,
          timestamp: lastPing.timestamp,
        }
      : null,
  })
}

// POST /api/alumno/checkin — SOLO VISUAL
// Registra un LocationPing (para que el representante vea la ubicación del hijo)
// NO crea ni modifica registros de asistencia. El profesor es la fuente de verdad.
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

  if (isD1()) {
    // Producción: D1
    const student = await d1First<{
      id: string
      plantelNombre: string
      plantelLat: number
      plantelLng: number
      plantelRadioM: number
    }>(
      `SELECT st.id,
              p.nombre AS plantelNombre, p.lat AS plantelLat, p.lng AS plantelLng, p.radioM AS plantelRadioM
       FROM v3_students st
       INNER JOIN v3_sections s ON s.id = st.sectionId
       LEFT JOIN v3_plantels p ON p.id = s.plantelId
       WHERE st.userId = ? LIMIT 1`,
      [payload.id]
    )
    if (!student) {
      return NextResponse.json({ error: 'Perfil de estudiante no encontrado' }, { status: 404 })
    }

    // Calcular distancia a la geocerca (solo visual)
    const distancia = haversineMeters(lat, lng, student.plantelLat, student.plantelLng)
    const dentroGeocerca = distancia <= student.plantelRadioM

    // Registrar LocationPing (para que el representante vea la ubicación)
    const pingId = uuidv4()
    const nowIso = new Date().toISOString()
    await d1Run(
      `INSERT INTO v3_location_pings (id, estudianteId, lat, lng, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [pingId, student.id, lat, lng, nowIso]
    )

    return NextResponse.json({
      ok: true,
      message: dentroGeocerca
        ? 'Estás dentro del plantel'
        : `Estás a ${distancia}m del plantel (fuera del rango permitido)`,
      dentroGeocerca,
      distancia,
      radioPermitido: student.plantelRadioM,
      plantelNombre: student.plantelNombre,
      timestamp: nowIso,
    })
  }

  // Desarrollo: Prisma
  const student = await db.student.findUnique({
    where: { userId: payload.id },
    select: {
      id: true,
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

  const plantel = student.section.plantel
  if (!plantel) {
    return NextResponse.json({ error: 'Tu sección no tiene plantel asociado' }, { status: 400 })
  }

  const distancia = haversineMeters(lat, lng, plantel.lat, plantel.lng)
  const dentroGeocerca = distancia <= plantel.radioM

  // Registrar LocationPing
  const ping = await db.locationPing.create({
    data: {
      estudianteId: student.id,
      lat,
      lng,
    },
  })

  return NextResponse.json({
    ok: true,
    message: dentroGeocerca
      ? 'Estás dentro del plantel'
      : `Estás a ${distancia}m del plantel (fuera del rango permitido)`,
    dentroGeocerca,
    distancia,
    radioPermitido: plantel.radioM,
    plantelNombre: plantel.nombre,
    timestamp: ping.timestamp,
  })
}
