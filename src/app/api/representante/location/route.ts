export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// Verifica que el estudiante pertenece al representante autenticado
async function verifyOwnership(
  representanteId: string,
  estudianteId: string
): Promise<boolean> {
  const link = await db.parentStudent.findUnique({
    where: {
      representanteId_estudianteId: { representanteId, estudianteId },
    },
    select: { id: true },
  })
  return !!link
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// GET /api/representante/location?estudianteId=xxx
//   ?wait=true&lastTimestamp=ISO  -> long polling: hasta 25s esperando un ping más reciente
// Devuelve: { lat, lng, timestamp, precision, stale? }
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'representante') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const estudianteId = searchParams.get('estudianteId')
  if (!estudianteId) {
    return NextResponse.json(
      { error: 'Parámetro estudianteId requerido' },
      { status: 400 }
    )
  }

  const isOwner = await verifyOwnership(payload.id, estudianteId)
  if (!isOwner) {
    return NextResponse.json(
      { error: 'No autorizado para este estudiante' },
      { status: 403 }
    )
  }

  const doWait = searchParams.get('wait') === 'true'
  const lastTimestampStr = searchParams.get('lastTimestamp')
  const lastTimestamp = lastTimestampStr ? new Date(lastTimestampStr) : null
  if (lastTimestampStr && isNaN(lastTimestamp?.getTime() || 0)) {
    return NextResponse.json(
      { error: 'lastTimestamp inválido' },
      { status: 400 }
    )
  }

  // Si NO hay wait, devolver el último ping inmediatamente
  if (!doWait) {
    const latest = await db.locationPing.findFirst({
      where: { estudianteId },
      orderBy: { timestamp: 'desc' },
    })
    if (!latest) {
      return NextResponse.json({ location: null })
    }
    return NextResponse.json({
      location: {
        id: latest.id,
        lat: latest.lat,
        lng: latest.lng,
        precision: latest.precision,
        timestamp: latest.timestamp,
      },
    })
  }

  // Long polling: revisar cada 3s hasta 25s esperando un ping más nuevo que lastTimestamp
  const POLL_INTERVAL = 3000
  const MAX_WAIT = 25000
  const start = Date.now()

  // Primera verificación inmediata
  let latest = await db.locationPing.findFirst({
    where: { estudianteId },
    orderBy: { timestamp: 'desc' },
  })

  const isNewer = (ping: { timestamp: Date } | null): boolean => {
    if (!ping) return false
    if (!lastTimestamp) return true
    return ping.timestamp.getTime() > lastTimestamp.getTime()
  }

  if (isNewer(latest)) {
    return NextResponse.json({
      location: latest
        ? {
            id: latest.id,
            lat: latest.lat,
            lng: latest.lng,
            precision: latest.precision,
            timestamp: latest.timestamp,
          }
        : null,
    })
  }

  // Bucle de polling
  while (Date.now() - start < MAX_WAIT) {
    await wait(POLL_INTERVAL)
    latest = await db.locationPing.findFirst({
      where: { estudianteId },
      orderBy: { timestamp: 'desc' },
    })
    if (isNewer(latest)) {
      return NextResponse.json({
        location: latest
          ? {
              id: latest.id,
              lat: latest.lat,
              lng: latest.lng,
              precision: latest.precision,
              timestamp: latest.timestamp,
            }
          : null,
      })
    }
  }

  // Timeout: devolver el último conocido con stale:true
  return NextResponse.json({
    location: latest
      ? {
          id: latest.id,
          lat: latest.lat,
          lng: latest.lng,
          precision: latest.precision,
          timestamp: latest.timestamp,
        }
      : null,
    stale: true,
  })
}
