import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run, d1Query } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { sendPushNotification } from '@/lib/push'
import { v4 as uuidv4 } from 'uuid'

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

// Verifica acceso del profesor a la sección (tutor o asignado)
async function checkSectionAccess(profesorId: string, sectionId: string): Promise<boolean> {
  if (isD1()) {
    const r = await d1First<{ id: string }>(
      `SELECT s.id FROM v3_sections s
       LEFT JOIN v3_section_assignments sa ON sa.sectionId = s.id AND sa.userId = ?
       WHERE s.id = ? AND (s.tutorId = ? OR sa.userId = ?) LIMIT 1`,
      [profesorId, sectionId, profesorId, profesorId]
    )
    return !!r
  }
  const section = await db.section.findFirst({
    where: {
      id: sectionId,
      OR: [{ tutorId: profesorId }, { assignments: { some: { userId: profesorId } } }],
    },
    select: { id: true },
  })
  return !!section
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
  const hasAccess = await checkSectionAccess(payload.id, sectionId)
  if (!hasAccess) {
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

  if (isD1()) {
    // Producción: D1
    const session = await d1First<{
      id: string
      estado: string
      fecha: string
    }>(
      `SELECT id, estado, fecha FROM v3_attendance_sessions
       WHERE sectionId = ? AND profesorId = ? AND fecha >= ? AND fecha <= ?
       ORDER BY fecha DESC
       LIMIT 1`,
      [sectionId, payload.id, start.toISOString(), end.toISOString()]
    )

    if (!session) {
      return NextResponse.json({ session: null })
    }

    const registros = await d1Query<{
      id: string
      estudianteId: string
      estado: string
      observacion: string | null
      origen: string
      estudianteId_st: string
      estudianteNombre: string
      estudianteApellido: string
      estudianteCedulaEscolar: string | null
      estudianteCodigoUnico: string
    }>(
      `SELECT a.id, a.estudianteId, a.estado, a.observacion, a.origen,
              st.id AS estudianteId_st, st.nombre AS estudianteNombre, st.apellido AS estudianteApellido,
              st.cedulaEscolar AS estudianteCedulaEscolar, st.codigoUnico AS estudianteCodigoUnico
       FROM v3_attendance a
       INNER JOIN v3_students st ON st.id = a.estudianteId
       WHERE a.sessionId = ?
       ORDER BY st.apellido ASC, st.nombre ASC`,
      [session.id]
    )

    return NextResponse.json({
      session: {
        id: session.id,
        estado: session.estado,
        fecha: session.fecha,
        registros: registros.map((a) => ({
          id: a.id,
          estudianteId: a.estudianteId,
          estado: a.estado,
          observacion: a.observacion,
          origen: a.origen,
          estudiante: {
            id: a.estudianteId_st,
            nombre: a.estudianteNombre,
            apellido: a.estudianteApellido,
            cedulaEscolar: a.estudianteCedulaEscolar,
            codigoUnico: a.estudianteCodigoUnico,
          },
        })),
      },
    })
  }

  // Desarrollo: Prisma
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
  const hasAccess = await checkSectionAccess(payload.id, sectionId)
  if (!hasAccess) {
    return NextResponse.json({ error: 'Sección no autorizada' }, { status: 403 })
  }

  if (isD1()) {
    // Producción: D1
    // Buscar o crear sesión de hoy
    let session = await d1First<{ id: string }>(
      `SELECT id FROM v3_attendance_sessions
       WHERE sectionId = ? AND profesorId = ? AND fecha >= ? AND fecha <= ?
       LIMIT 1`,
      [sectionId, payload.id, startOfToday().toISOString(), endOfToday().toISOString()]
    )

    if (!session) {
      const newId = uuidv4()
      const now = new Date().toISOString()
      await d1Run(
        `INSERT INTO v3_attendance_sessions (id, sectionId, profesorId, fecha, estado, createdAt)
         VALUES (?, ?, ?, ?, 'activa', ?)`,
        [newId, sectionId, payload.id, now, now]
      )
      session = { id: newId }
    }

    // Upsert attendance records + crear notificaciones para ausencias/tardanzas
    const notifsToCreate: Array<{
      destinatarioId: string
      tipo: string
      titulo: string
      mensaje: string
    }> = []

    for (const r of registros) {
      const existing = await d1First<{ id: string }>(
        'SELECT id FROM v3_attendance WHERE estudianteId = ? AND sessionId = ? LIMIT 1',
        [r.estudianteId, session!.id]
      )

      const nowIso = new Date().toISOString()
      if (existing) {
        await d1Run(
          `UPDATE v3_attendance SET estado = ?, observacion = ?, origen = 'profesor', marcadoPor = ?, fecha = ? WHERE id = ?`,
          [r.estado, r.observacion || null, payload.id, nowIso, existing.id]
        )
      } else {
        const aId = uuidv4()
        await d1Run(
          `INSERT INTO v3_attendance (id, estudianteId, sessionId, estado, observacion, origen, lat, lng, marcadoPor, fecha)
           VALUES (?, ?, ?, ?, ?, 'profesor', NULL, NULL, ?, ?)`,
          [aId, r.estudianteId, session!.id, r.estado, r.observacion || null, payload.id, nowIso]
        )
      }

      // Notificar al representante si ausente o tardanza
      if (r.estado === 'ausente' || r.estado === 'tardanza') {
        const parents = await d1Query<{
          representanteId: string
          estudianteNombre: string
          estudianteApellido: string
        }>(
          `SELECT ps.representanteId, st.nombre AS estudianteNombre, st.apellido AS estudianteApellido
           FROM v3_parent_student ps
           INNER JOIN v3_students st ON st.id = ps.estudianteId
           WHERE ps.estudianteId = ? AND ps.esPrincipal = 1`,
          [r.estudianteId]
        )
        for (const p of parents) {
          const titulo =
            r.estado === 'ausente' ? 'Ausencia registrada' : 'Llegada tarde registrada'
          const mensaje = `${p.estudianteNombre} ${p.estudianteApellido} fue marcado como ${r.estado} hoy.`
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
      const nowIso = new Date().toISOString()
      for (const n of notifsToCreate) {
        const nId = uuidv4()
        await d1Run(
          `INSERT INTO v3_notifications (id, destinatarioId, tipo, titulo, mensaje, leida, createdAt)
           VALUES (?, ?, ?, ?, ?, 0, ?)`,
          [nId, n.destinatarioId, n.tipo, n.titulo, n.mensaje, nowIso]
        )
      }
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

  // Desarrollo: Prisma
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

  if (isD1()) {
    // Producción: D1
    const session = await d1First<{
      id: string
      sectionId: string
      profesorId: string
      tutorId: string | null
      hasAssignment: number
    }>(
      `SELECT sess.id, sess.sectionId, sess.profesorId, s.tutorId,
              (SELECT COUNT(*) FROM v3_section_assignments sa WHERE sa.sectionId = s.id AND sa.userId = ?) AS hasAssignment
       FROM v3_attendance_sessions sess
       INNER JOIN v3_sections s ON s.id = sess.sectionId
       WHERE sess.id = ? LIMIT 1`,
      [payload.id, sessionId]
    )

    if (!session) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
    }

    // Validar acceso
    const hasAccess =
      session.profesorId === payload.id ||
      session.tutorId === payload.id ||
      session.hasAssignment > 0
    if (!hasAccess) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Listar todos los estudiantes activos de la sección + representantes principales
    const students = await d1Query<{
      id: string
      nombre: string
      apellido: string
      representanteId: string
    }>(
      `SELECT st.id, st.nombre, st.apellido, ps.representanteId
       FROM v3_students st
       INNER JOIN v3_parent_student ps ON ps.estudianteId = st.id AND ps.esPrincipal = 1
       WHERE st.sectionId = ? AND st.activo = 1`,
      [session.sectionId]
    )

    // Auto-marcar ausentes a los no registrados
    const notifsToCreate: Array<{
      destinatarioId: string
      tipo: string
      titulo: string
      mensaje: string
    }> = []

    const studentsMap: Record<string, { id: string; nombre: string; apellido: string; parents: string[] }> = {}
    for (const s of students) {
      if (!studentsMap[s.id]) {
        studentsMap[s.id] = { id: s.id, nombre: s.nombre, apellido: s.apellido, parents: [] }
      }
      studentsMap[s.id].parents.push(s.representanteId)
    }

    let autoMarcadosAusentes = 0
    const nowIso = new Date().toISOString()
    for (const sid in studentsMap) {
      const s = studentsMap[sid]
      const existing = await d1First<{ id: string }>(
        'SELECT id FROM v3_attendance WHERE estudianteId = ? AND sessionId = ? LIMIT 1',
        [s.id, session.id]
      )

      if (!existing) {
        const aId = uuidv4()
        await d1Run(
          `INSERT INTO v3_attendance (id, estudianteId, sessionId, estado, observacion, origen, lat, lng, marcadoPor, fecha)
           VALUES (?, ?, ?, 'ausente', NULL, 'profesor', NULL, NULL, ?, ?)`,
          [aId, s.id, session.id, payload.id, nowIso]
        )

        for (const rid of s.parents) {
          notifsToCreate.push({
            destinatarioId: rid,
            tipo: 'ausencia',
            titulo: 'Ausencia registrada',
            mensaje: `${s.nombre} ${s.apellido} fue marcado como ausente (cierre de sesión).`,
          })
          autoMarcadosAusentes++
        }
      }
    }

    // Cerrar sesión
    await d1Run('UPDATE v3_attendance_sessions SET estado = ? WHERE id = ?', [
      'cerrada',
      session.id,
    ])

    if (notifsToCreate.length > 0) {
      const nIso = new Date().toISOString()
      for (const n of notifsToCreate) {
        const nId = uuidv4()
        await d1Run(
          `INSERT INTO v3_notifications (id, destinatarioId, tipo, titulo, mensaje, leida, createdAt)
           VALUES (?, ?, ?, ?, ?, 0, ?)`,
          [nId, n.destinatarioId, n.tipo, n.titulo, n.mensaje, nIso]
        )
      }
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
      autoMarcadosAusentes,
    })
  }

  // Desarrollo: Prisma
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
