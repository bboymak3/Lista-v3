export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { sendPushNotification } from '@/lib/push'

// Helper: hoy a medianoche (UTC) — usamos fechas del día en zona local del servidor
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

// GET /api/profesor/attendance?sectionId=xxx[&date=YYYY-MM-DD]
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'profesor') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const sectionId = searchParams.get('sectionId')
  if (!sectionId) {
    return NextResponse.json({ error: 'sectionId es requerido' }, { status: 400 })
  }

  // Validar acceso a la sección
  const section = await db.section.findFirst({
    where: {
      id: sectionId,
      OR: [{ tutorId: payload.id }, { assignments: { some: { userId: payload.id } } }],
    },
    select: { id: true },
  })
  if (!section) {
    return NextResponse.json({ error: 'Sección no autorizada' }, { status: 403 })
  }

  const dateParam = searchParams.get('date')
  let start: Date
  let end: Date
  if (dateParam) {
    start = new Date(dateParam + 'T00:00:00')
    end = new Date(dateParam + 'T23:59:59.999')
  } else {
    start = startOfToday()
    end = endOfToday()
  }

  const session = await db.attendanceSession.findFirst({
    where: {
      sectionId,
      profesorId: payload.id,
      fecha: { gte: start, lte: end },
    },
    include: {
      attendance: {
        include: {
          estudiante: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              cedulaEscolar: true,
              codigoUnico: true,
            },
          },
        },
      },
    },
    orderBy: { fecha: 'desc' },
  })

  return NextResponse.json({
    session: session
      ? {
          id: session.id,
          estado: session.estado,
          fecha: session.fecha,
          registros: session.attendance.map((a) => ({
            id: a.id,
            estudianteId: a.estudianteId,
            estado: a.estado,
            observacion: a.observacion,
            origen: a.origen,
            estudiante: a.estudiante,
          })),
        }
      : null,
  })
}

// POST /api/profesor/attendance
// Body: { sectionId, registros: [{estudianteId, estado, observacion?}] }
export async function POST(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'profesor') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { sectionId, registros } = body as {
    sectionId: string
    registros: Array<{ estudianteId: string; estado: string; observacion?: string }>
  }

  if (!sectionId || !Array.isArray(registros)) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  // Validar estados
  const estadosValidos = ['presente', 'ausente', 'tardanza', 'justificado']
  for (const r of registros) {
    if (!estadosValidos.includes(r.estado)) {
      return NextResponse.json(
        { error: `Estado inválido: ${r.estado}` },
        { status: 400 }
      )
    }
  }

  // Validar acceso a la sección
  const section = await db.section.findFirst({
    where: {
      id: sectionId,
      OR: [{ tutorId: payload.id }, { assignments: { some: { userId: payload.id } } }],
    },
    select: { id: true },
  })
  if (!section) {
    return NextResponse.json({ error: 'Sección no autorizada' }, { status: 403 })
  }

  // Buscar o crear sesión de hoy
  let session = await db.attendanceSession.findFirst({
    where: {
      sectionId,
      profesorId: payload.id,
      fecha: { gte: startOfToday(), lte: endOfToday() },
    },
  })

  if (!session) {
    session = await db.attendanceSession.create({
      data: {
        sectionId,
        profesorId: payload.id,
        fecha: new Date(),
        estado: 'activa',
      },
    })
  }

  // Upsert attendance records + crear notificaciones para ausencias/tardanzas
  const notifsToCreate: Array<{
    destinatarioId: string
    tipo: string
    titulo: string
    mensaje: string
  }> = []

  for (const r of registros) {
    const existing = await db.attendance.findUnique({
      where: {
        estudianteId_sessionId: {
          estudianteId: r.estudianteId,
          sessionId: session.id,
        },
      },
    })

    if (existing) {
      await db.attendance.update({
        where: { id: existing.id },
        data: {
          estado: r.estado,
          observacion: r.observacion || null,
          origen: 'profesor',
          marcadoPor: payload.id,
          fecha: new Date(),
        },
      })
    } else {
      await db.attendance.create({
        data: {
          estudianteId: r.estudianteId,
          sessionId: session.id,
          estado: r.estado,
          observacion: r.observacion || null,
          origen: 'profesor',
          marcadoPor: payload.id,
        },
      })
    }

    // Notificar al representante si ausente o tardanza
    if (r.estado === 'ausente' || r.estado === 'tardanza') {
      const parents = await db.parentStudent.findMany({
        where: { estudianteId: r.estudianteId, esPrincipal: true },
        select: {
          representanteId: true,
          estudiante: { select: { nombre: true, apellido: true } },
        },
      })
      for (const p of parents) {
        const titulo =
          r.estado === 'ausente' ? 'Ausencia registrada' : 'Llegada tarde registrada'
        const mensaje = `${p.estudiante.nombre} ${p.estudiante.apellido} fue marcado como ${r.estado} hoy.`
        notifsToCreate.push({
          destinatarioId: p.representanteId,
          tipo: r.estado,
          titulo,
          mensaje,
        })
      }
    }
  }

  if (notifsToCreate.length > 0) {
    await db.notification.createMany({ data: notifsToCreate })
    // Enviar push notifications a los representantes (fire-and-forget)
    for (const n of notifsToCreate) {
      sendPushNotification(n.destinatarioId, {
        title: n.titulo,
        body: n.mensaje,
        tipo: n.tipo,
        url: '/',
      })
    }
  }

  return NextResponse.json({ ok: true, sessionId: session.id })
}

// PUT /api/profesor/attendance — cerrar sesión
// Body: { sessionId } o query ?sessionId=xxx
export async function PUT(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'profesor') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { searchParams } = new URL(request.url)
  const sessionId = body.sessionId || searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId es requerido' }, { status: 400 })
  }

  const session = await db.attendanceSession.findUnique({
    where: { id: sessionId },
    include: {
      section: {
        select: {
          id: true,
          tutorId: true,
          assignments: { where: { userId: payload.id }, select: { userId: true } },
        },
      },
    },
  })

  if (!session) {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  }

  // Validar que el profesor tiene acceso
  const hasAccess =
    session.profesorId === payload.id ||
    session.section.tutorId === payload.id ||
    session.section.assignments.length > 0
  if (!hasAccess) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Listar todos los estudiantes activos de la sección
  const students = await db.student.findMany({
    where: { sectionId: session.sectionId, activo: true },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      parents: { where: { esPrincipal: true }, select: { representanteId: true } },
    },
  })

  // Auto-marcar ausentes a los no registrados
  const notifsToCreate: Array<{
    destinatarioId: string
    tipo: string
    titulo: string
    mensaje: string
  }> = []

  for (const s of students) {
    const existing = await db.attendance.findUnique({
      where: {
        estudianteId_sessionId: {
          estudianteId: s.id,
          sessionId: session.id,
        },
      },
    })

    if (!existing) {
      await db.attendance.create({
        data: {
          estudianteId: s.id,
          sessionId: session.id,
          estado: 'ausente',
          origen: 'profesor',
          marcadoPor: payload.id,
        },
      })

      for (const p of s.parents) {
        notifsToCreate.push({
          destinatarioId: p.representanteId,
          tipo: 'ausencia',
          titulo: 'Ausencia registrada',
          mensaje: `${s.nombre} ${s.apellido} fue marcado como ausente (cierre de sesión).`,
        })
      }
    }
  }

  // Cerrar sesión
  await db.attendanceSession.update({
    where: { id: session.id },
    data: { estado: 'cerrada' },
  })

  if (notifsToCreate.length > 0) {
    await db.notification.createMany({ data: notifsToCreate })
    // Enviar push notifications a los representantes (fire-and-forget)
    for (const n of notifsToCreate) {
      sendPushNotification(n.destinatarioId, {
        title: n.titulo,
        body: n.mensaje,
        tipo: n.tipo,
        url: '/',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    autoMarcadosAusentes: notifsToCreate.length,
  })
}
