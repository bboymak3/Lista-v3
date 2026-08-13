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

// GET /api/profesor/checkin — estado de check-in de hoy + historial 7 días
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'profesor') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const todayCheckins = await db.professorCheckin.findMany({
    where: {
      profesorId: payload.id,
      timestamp: { gte: startOfToday(), lte: endOfToday() },
    },
    orderBy: { timestamp: 'asc' },
  })

  const entrada = todayCheckins.find((c) => c.tipo === 'entrada')
  const salida = todayCheckins.find((c) => c.tipo === 'salida')

  // Historial últimos 7 días
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const history = await db.professorCheckin.findMany({
    where: {
      profesorId: payload.id,
      timestamp: { gte: sevenDaysAgo },
    },
    orderBy: { timestamp: 'desc' },
    take: 50,
  })

  return NextResponse.json({
    hoy: {
      entrada: entrada
        ? { id: entrada.id, timestamp: entrada.timestamp, lat: entrada.lat, lng: entrada.lng }
        : null,
      salida: salida
        ? { id: salida.id, timestamp: salida.timestamp, lat: salida.lat, lng: salida.lng }
        : null,
    },
    historial: history.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      timestamp: c.timestamp,
      lat: c.lat,
      lng: c.lng,
    })),
  })
}

// POST /api/profesor/checkin
// Body: { tipo: 'entrada' | 'salida', lat?: number, lng?: number }
export async function POST(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'profesor') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { tipo, lat, lng } = body as {
    tipo: string
    lat?: number
    lng?: number
  }

  if (tipo !== 'entrada' && tipo !== 'salida') {
    return NextResponse.json({ error: 'Tipo inválido (entrada | salida)' }, { status: 400 })
  }

  // Verificar check-ins de hoy
  const todayCheckins = await db.professorCheckin.findMany({
    where: {
      profesorId: payload.id,
      timestamp: { gte: startOfToday(), lte: endOfToday() },
    },
  })

  const tieneEntrada = todayCheckins.some((c) => c.tipo === 'entrada')
  const tieneSalida = todayCheckins.some((c) => c.tipo === 'salida')

  if (tipo === 'entrada') {
    // Solo una entrada por día — si ya existe, devolver la existente
    if (tieneEntrada) {
      const existente = todayCheckins.find((c) => c.tipo === 'entrada')!
      return NextResponse.json({
        ok: true,
        yaExistente: true,
        checkin: {
          id: existente.id,
          tipo: existente.tipo,
          timestamp: existente.timestamp,
          lat: existente.lat,
          lng: existente.lng,
        },
      })
    }
  } else {
    // salida
    if (!tieneEntrada) {
      return NextResponse.json(
        { error: 'Debes registrar entrada primero' },
        { status: 400 }
      )
    }
    if (tieneSalida) {
      const existente = todayCheckins.find((c) => c.tipo === 'salida')!
      return NextResponse.json({
        ok: true,
        yaExistente: true,
        checkin: {
          id: existente.id,
          tipo: existente.tipo,
          timestamp: existente.timestamp,
          lat: existente.lat,
          lng: existente.lng,
        },
      })
    }
  }

  const checkin = await db.professorCheckin.create({
    data: {
      profesorId: payload.id,
      tipo,
      lat: typeof lat === 'number' ? lat : null,
      lng: typeof lng === 'number' ? lng : null,
    },
  })

  return NextResponse.json({
    ok: true,
    yaExistente: false,
    checkin: {
      id: checkin.id,
      tipo: checkin.tipo,
      timestamp: checkin.timestamp,
      lat: checkin.lat,
      lng: checkin.lng,
    },
  })
}
