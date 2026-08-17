import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'

// POST /api/cron/purge-gps
// Purges old LocationPing records (> 30 days) and read notifications (> 90 days).
// Protected by X-Cron-Secret header that must match process.env.CRON_SECRET.
//
// This endpoint is intended to be invoked by:
//   - Cloudflare Cron Trigger (scheduled event)
//   - External monitors (UptimeRobot, cron-job.org, GitHub Actions)
//
// See CRON_SETUP.md for setup instructions.
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret) {
    // CRON_SECRET not configured — refuse to run to prevent abuse.
    return NextResponse.json(
      { error: 'CRON_SECRET no configurado en el servidor' },
      { status: 503 }
    )
  }
  if (secret !== expectedSecret) {
    return NextResponse.json(
      { error: 'No autorizado' },
      { status: 401 }
    )
  }

  try {
    const now = new Date()
    const gpsCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 días
    const notifCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) // 90 días

    let gpsDeleted = 0
    let notifDeleted = 0

    if (isD1()) {
      // Producción: D1 — count first (d1Run returns void), then delete.
      const gpsCount = await d1First<{ count: number }>(
        'SELECT COUNT(*) as count FROM v3_location_pings WHERE timestamp < ?',
        [gpsCutoff.toISOString()]
      )
      gpsDeleted = gpsCount?.count || 0
      await d1Run(
        'DELETE FROM v3_location_pings WHERE timestamp < ?',
        [gpsCutoff.toISOString()]
      )

      const notifCount = await d1First<{ count: number }>(
        'SELECT COUNT(*) as count FROM v3_notifications WHERE createdAt < ? AND leida = 1',
        [notifCutoff.toISOString()]
      )
      notifDeleted = notifCount?.count || 0
      await d1Run(
        'DELETE FROM v3_notifications WHERE createdAt < ? AND leida = 1',
        [notifCutoff.toISOString()]
      )
    } else {
      // Desarrollo: Prisma
      const gpsResult = await db.locationPing.deleteMany({
        where: { timestamp: { lt: gpsCutoff } },
      })
      gpsDeleted = gpsResult.count

      const notifResult = await db.notification.deleteMany({
        where: {
          createdAt: { lt: notifCutoff },
          leida: true,
        },
      })
      notifDeleted = notifResult.count
    }

    return NextResponse.json({
      ok: true,
      deleted: gpsDeleted + notifDeleted,
      details: {
        locationPings: gpsDeleted,
        notifications: notifDeleted,
        gpsCutoff: gpsCutoff.toISOString(),
        notifCutoff: notifCutoff.toISOString(),
      },
    })
  } catch (error) {
    console.error('Purge GPS cron error:', error)
    return NextResponse.json(
      { error: 'Error al ejecutar limpieza', detail: (error as Error).message },
      { status: 500 }
    )
  }
}

// GET — convenience for external monitors that don't support POST.
// Same logic, same auth. Useful for UptimeRobot's simple HTTP checks.
export async function GET(request: NextRequest) {
  return POST(request)
}
