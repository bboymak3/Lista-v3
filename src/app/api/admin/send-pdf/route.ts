import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Query, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { sendPushNotification } from '@/lib/push'
import { v4 as uuidv4 } from 'uuid'
import { promises as fs } from 'node:fs'
import path from 'node:path'

function getCloudflareContext(): any | null {
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as any)[sym]
    if (ctx?.env) return ctx
  } catch { /* ignore */ }
  return null
}

type Destinatarios = 'representantes' | 'alumnos' | 'ambos'

// POST /api/admin/send-pdf — admin envía un PDF a una sección
// FormData: file (PDF), sectionId, contenido, destinatarios
export async function POST(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'admin') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const sectionId = formData.get('sectionId')
    const contenidoRaw = formData.get('contenido')
    const destinatariosRaw = formData.get('destinatarios')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo PDF no proporcionado' }, { status: 400 })
    }
    if (!sectionId || typeof sectionId !== 'string') {
      return NextResponse.json({ error: 'sectionId es requerido' }, { status: 400 })
    }

    const contenido = typeof contenidoRaw === 'string' ? contenidoRaw : ''
    const destinatarios: Destinatarios =
      destinatariosRaw === 'alumnos' || destinatariosRaw === 'ambos'
        ? (destinatariosRaw as Destinatarios)
        : 'representantes'

    // Validar PDF
    const MAX_SIZE = 15 * 1024 * 1024 // 15MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El PDF excede 15MB' }, { status: 413 })
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (ext !== 'pdf' && file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Solo se permiten archivos PDF' }, { status: 400 })
    }

    // Validar que la sección exista
    let sectionNombre = ''
    if (isD1()) {
      const section = await d1First<{ id: string; nombre: string }>(
        'SELECT id, nombre FROM v3_sections WHERE id = ? LIMIT 1',
        [sectionId]
      )
      if (!section) {
        return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
      }
      sectionNombre = section.nombre
    } else {
      const section = await db.section.findUnique({
        where: { id: sectionId },
        select: { id: true, nombre: true },
      })
      if (!section) {
        return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
      }
      sectionNombre = section.nombre
    }

    // Subir el PDF (R2 prod / fs dev)
    const mediaKey = `pdf-${uuidv4()}.pdf`
    if (isD1()) {
      const ctx = getCloudflareContext()
      const bucket = ctx?.env?.BUCKET as R2Bucket | undefined
      if (!bucket || typeof bucket.put !== 'function') {
        return NextResponse.json({ error: 'R2 no disponible' }, { status: 500 })
      }
      const arrayBuffer = await file.arrayBuffer()
      await bucket.put(mediaKey, arrayBuffer, {
        httpMetadata: { contentType: 'application/pdf' },
      })
    } else {
      // Desarrollo: filesystem en public/uploads/<mediaKey>
      const filePath = path.join(process.cwd(), 'public', 'uploads', mediaKey)
      const fileDir = path.dirname(filePath)
      await fs.mkdir(fileDir, { recursive: true })
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      await fs.writeFile(filePath, buffer)
    }

    // Mensaje default si está vacío
    const mensajeFinal = contenido.trim() || `Documento PDF enviado a la sección ${sectionNombre}`

    // Crear FeedPost tipo='pdf'
    const postId = uuidv4()
    const nowIso = new Date().toISOString()
    if (isD1()) {
      await d1Run(
        `INSERT INTO v3_feed_posts (id, profesorId, sectionId, tipo, contenido, mediaKey, createdAt)
         VALUES (?, ?, ?, 'pdf', ?, ?, ?)`,
        [postId, payload.id, sectionId, mensajeFinal, mediaKey, nowIso]
      )
    } else {
      await db.feedPost.create({
        data: {
          id: postId,
          profesorId: payload.id,
          sectionId,
          tipo: 'pdf',
          contenido: mensajeFinal,
          mediaKey,
        },
      })
    }

    // Recopiliar destinatarios
    const tituloNotif = `PDF · Sección ${sectionNombre}`
    const mensajeNotif =
      mensajeFinal.length > 120 ? mensajeFinal.slice(0, 120) + '…' : mensajeFinal

    const notifyUserIds: string[] = []

    if (isD1()) {
      if (destinatarios === 'representantes' || destinatarios === 'ambos') {
        const reps = await d1Query<{ representanteId: string }>(
          `SELECT DISTINCT ps.representanteId
           FROM v3_parent_student ps
           INNER JOIN v3_students st ON st.id = ps.estudianteId
           WHERE ps.esPrincipal = 1 AND st.sectionId = ? AND st.activo = 1`,
          [sectionId]
        )
        for (const r of reps) notifyUserIds.push(r.representanteId)
      }
      if (destinatarios === 'alumnos' || destinatarios === 'ambos') {
        const alumnos = await d1Query<{ userId: string }>(
          `SELECT st.userId FROM v3_students st
           WHERE st.sectionId = ? AND st.activo = 1 AND st.userId IS NOT NULL`,
          [sectionId]
        )
        for (const a of alumnos) {
          if (a.userId) notifyUserIds.push(a.userId)
        }
      }

      // Crear notificaciones
      const uniqueIds = Array.from(new Set(notifyUserIds))
      for (const uid of uniqueIds) {
        const nId = uuidv4()
        await d1Run(
          `INSERT INTO v3_notifications (id, destinatarioId, tipo, titulo, mensaje, leida, createdAt)
           VALUES (?, ?, 'feed', ?, ?, 0, ?)`,
          [nId, uid, tituloNotif, mensajeNotif, nowIso]
        )
      }

      // Push notifications (fire-and-forget)
      for (const uid of uniqueIds) {
        sendPushNotification(uid, {
          title: tituloNotif,
          body: mensajeNotif,
          tipo: 'feed',
          url: '/',
        })
      }

      return NextResponse.json({
        ok: true,
        postId,
        mediaKey,
        destinatarios: uniqueIds.length,
      })
    }

    // Dev: Prisma
    if (destinatarios === 'representantes' || destinatarios === 'ambos') {
      const reps = await db.parentStudent.findMany({
        where: {
          esPrincipal: true,
          estudiante: { sectionId, activo: true },
        },
        select: { representanteId: true },
        distinct: ['representanteId'],
      })
      for (const r of reps) notifyUserIds.push(r.representanteId)
    }
    if (destinatarios === 'alumnos' || destinatarios === 'ambos') {
      const alumnos = await db.student.findMany({
        where: {
          sectionId,
          activo: true,
          userId: { not: null },
        },
        select: { userId: true },
      })
      for (const a of alumnos) {
        if (a.userId) notifyUserIds.push(a.userId)
      }
    }

    const uniqueIds = Array.from(new Set(notifyUserIds))
    if (uniqueIds.length > 0) {
      await db.notification.createMany({
        data: uniqueIds.map((uid) => ({
          destinatarioId: uid,
          tipo: 'feed',
          titulo: tituloNotif,
          mensaje: mensajeNotif,
        })),
      })
      for (const uid of uniqueIds) {
        sendPushNotification(uid, {
          title: tituloNotif,
          body: mensajeNotif,
          tipo: 'feed',
          url: '/',
        })
      }
    }

    return NextResponse.json({
      ok: true,
      postId,
      mediaKey,
      destinatarios: uniqueIds.length,
    })
  } catch (error) {
    console.error('Admin send-pdf error:', error)
    return NextResponse.json({ error: 'Error al enviar PDF' }, { status: 500 })
  }
}
