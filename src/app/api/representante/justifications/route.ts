import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1Query, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { sendPushNotification } from '@/lib/push'
import { v4 as uuidv4 } from 'uuid'

// ============================================
// Helper: lista de IDs de destinatarios (tutor de la sección + admins activos)
// ============================================
async function getTutorAndAdmins(
  sectionId: string,
  isD1Mode: boolean
): Promise<string[]> {
  const ids = new Set<string>()

  if (isD1Mode) {
    const section = await d1First<{ tutorId: string | null }>(
      'SELECT tutorId FROM v3_sections WHERE id = ? LIMIT 1',
      [sectionId]
    )
    if (section?.tutorId) ids.add(section.tutorId)
    const admins = await d1Query<{ id: string }>(
      "SELECT id FROM v3_users WHERE rol = 'admin' AND activo = 1"
    )
    for (const a of admins) ids.add(a.id)
  } else {
    const section = await db.section.findUnique({
      where: { id: sectionId },
      select: { tutorId: true },
    })
    if (section?.tutorId) ids.add(section.tutorId)
    const admins = await db.user.findMany({
      where: { rol: 'admin', activo: true },
      select: { id: true },
    })
    for (const a of admins) ids.add(a.id)
  }

  return Array.from(ids)
}

// ============================================
// Helper: validar que el estudiante pertenece al representante
// ============================================
async function verifyStudentOwnership(
  representanteId: string,
  estudianteId: string,
  isD1Mode: boolean
): Promise<boolean> {
  if (isD1Mode) {
    const link = await d1First<{ id: string }>(
      'SELECT id FROM v3_parent_student WHERE representanteId = ? AND estudianteId = ? LIMIT 1',
      [representanteId, estudianteId]
    )
    return !!link
  }
  const link = await db.parentStudent.findFirst({
    where: { representanteId, estudianteId },
    select: { id: true },
  })
  return !!link
}

// ============================================
// Helper: obtener nombre y sección del estudiante
// ============================================
async function getStudentInfo(
  estudianteId: string,
  isD1Mode: boolean
): Promise<{ nombre: string; apellido: string; sectionId: string } | null> {
  if (isD1Mode) {
    return d1First<{ nombre: string; apellido: string; sectionId: string }>(
      'SELECT nombre, apellido, sectionId FROM v3_students WHERE id = ? LIMIT 1',
      [estudianteId]
    )
  }
  return db.student.findUnique({
    where: { id: estudianteId },
    select: { nombre: true, apellido: true, sectionId: true },
  })
}

// ============================================
// Motivos válidos y su etiqueta legible
// ============================================
const MOTIVOS_VALIDOS = ['enfermedad', 'cita_medica', 'viaje', 'familiar', 'otro']

export const MOTIVO_LABELS: Record<string, string> = {
  enfermedad: 'Enfermedad',
  cita_medica: 'Cita médica',
  viaje: 'Viaje',
  familiar: 'Familiar',
  otro: 'Otro',
}

// GET /api/representante/justifications
// Lista justificaciones de los hijos del representante (últimos 30 días).
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'representante') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  // Fecha límite: 30 días atrás en YYYY-MM-DD
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceIso = since.toISOString()

  if (isD1()) {
    // Producción: D1 crudo
    const rows = await d1Query<{
      id: string
      estudianteId: string
      representanteId: string
      fecha: string
      motivo: string
      descripcion: string | null
      estado: string
      createdAt: string
      estudianteNombre: string
      estudianteApellido: string
    }>(
      `SELECT j.id, j.estudianteId, j.representanteId, j.fecha, j.motivo, j.descripcion, j.estado, j.createdAt,
              st.nombre AS estudianteNombre, st.apellido AS estudianteApellido
       FROM v3_justifications j
       INNER JOIN v3_students st ON st.id = j.estudianteId
       WHERE j.representanteId = ? AND j.createdAt >= ?
       ORDER BY j.createdAt DESC
       LIMIT 200`,
      [payload.id, sinceIso]
    )

    return NextResponse.json({
      justifications: rows.map((j) => ({
        id: j.id,
        estudianteId: j.estudianteId,
        estudianteNombre: j.estudianteNombre,
        estudianteApellido: j.estudianteApellido,
        representanteId: j.representanteId,
        fecha: j.fecha,
        motivo: j.motivo,
        motivoLabel: MOTIVO_LABELS[j.motivo] || j.motivo,
        descripcion: j.descripcion,
        estado: j.estado,
        createdAt: j.createdAt,
      })),
    })
  }

  // Desarrollo: Prisma
  const rows = await db.justification.findMany({
    where: {
      representanteId: payload.id,
      createdAt: { gte: since },
    },
    include: {
      estudiante: { select: { nombre: true, apellido: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({
    justifications: rows.map((j) => ({
      id: j.id,
      estudianteId: j.estudianteId,
      estudianteNombre: j.estudiante.nombre,
      estudianteApellido: j.estudiante.apellido,
      representanteId: j.representanteId,
      fecha: j.fecha,
      motivo: j.motivo,
      motivoLabel: MOTIVO_LABELS[j.motivo] || j.motivo,
      descripcion: j.descripcion,
      estado: j.estado,
      createdAt: j.createdAt,
    })),
  })
}

// POST /api/representante/justifications
// Body: { estudianteId, fecha (YYYY-MM-DD), motivo, descripcion? }
export async function POST(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'representante') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { estudianteId, fecha, motivo, descripcion } = body as {
    estudianteId?: string
    fecha?: string
    motivo?: string
    descripcion?: string
  }

  // Validaciones básicas
  if (!estudianteId || !fecha || !motivo) {
    return NextResponse.json(
      { error: 'estudianteId, fecha y motivo son requeridos' },
      { status: 400 }
    )
  }

  // Validar formato YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json(
      { error: 'La fecha debe tener formato YYYY-MM-DD' },
      { status: 400 }
    )
  }

  if (!MOTIVOS_VALIDOS.includes(motivo)) {
    return NextResponse.json(
      { error: `Motivo inválido. Válidos: ${MOTIVOS_VALIDOS.join(', ')}` },
      { status: 400 }
    )
  }

  const d1Mode = isD1()

  // Verificar que el estudiante pertenece al representante
  const owns = await verifyStudentOwnership(payload.id, estudianteId, d1Mode)
  if (!owns) {
    return NextResponse.json(
      { error: 'El estudiante no está asociado a tu cuenta' },
      { status: 403 }
    )
  }

  // Obtener info del estudiante (nombre + sectionId) para notificación
  const studentInfo = await getStudentInfo(estudianteId, d1Mode)
  if (!studentInfo) {
    return NextResponse.json(
      { error: 'Estudiante no encontrado' },
      { status: 404 }
    )
  }

  const descripcionTrim = descripcion?.trim() || null
  const justId = uuidv4()
  const nowIso = new Date().toISOString()

  if (d1Mode) {
    // Producción: D1 crudo
    await d1Run(
      `INSERT INTO v3_justifications (id, estudianteId, representanteId, fecha, motivo, descripcion, estado, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
      [justId, estudianteId, payload.id, fecha, motivo, descripcionTrim, nowIso]
    )
  } else {
    // Desarrollo: Prisma
    await db.justification.create({
      data: {
        id: justId,
        estudianteId,
        representanteId: payload.id,
        fecha,
        motivo,
        descripcion: descripcionTrim,
        estado: 'pendiente',
      },
    })
  }

  // Notificar al tutor de la sección + admins
  const destinatarios = await getTutorAndAdmins(studentInfo.sectionId, d1Mode)
  const nombreCompleto = `${studentInfo.nombre} ${studentInfo.apellido}`
  const titulo = `Justificación de ${nombreCompleto}`
  const motivoLabel = MOTIVO_LABELS[motivo] || motivo
  const mensaje = `El representante notifica ausencia para el ${fecha}. Motivo: ${motivoLabel}.` +
    (descripcionTrim ? ` Nota: ${descripcionTrim}` : '')

  for (const destId of destinatarios) {
    if (d1Mode) {
      const nId = uuidv4()
      await d1Run(
        `INSERT INTO v3_notifications (id, destinatarioId, tipo, titulo, mensaje, leida, createdAt)
         VALUES (?, ?, 'justificacion', ?, ?, 0, ?)`,
        [nId, destId, titulo, mensaje, nowIso]
      )
    } else {
      await db.notification.create({
        data: {
          destinatarioId: destId,
          tipo: 'justificacion',
          titulo,
          mensaje,
        },
      })
    }
    // Push (fire-and-forget)
    sendPushNotification(destId, {
      title: titulo,
      body: mensaje,
      tipo: 'justificacion',
      url: '/',
    })
  }

  return NextResponse.json({
    id: justId,
    estudianteId,
    estudianteNombre: studentInfo.nombre,
    estudianteApellido: studentInfo.apellido,
    representanteId: payload.id,
    fecha,
    motivo,
    motivoLabel,
    descripcion: descripcionTrim,
    estado: 'pendiente',
    createdAt: nowIso,
  })
}
