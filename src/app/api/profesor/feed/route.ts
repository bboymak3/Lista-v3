import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Query, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { sendPushNotification } from '@/lib/push'
import { v4 as uuidv4 } from 'uuid'

// Verifica acceso del profesor a la sección (tutor o asignado) y devuelve el nombre de la sección
async function checkSectionAccess(profesorId: string, sectionId: string): Promise<{ id: string; nombre: string } | null> {
  if (isD1()) {
    const r = await d1First<{ id: string; nombre: string }>(
      `SELECT s.id, s.nombre FROM v3_sections s
       LEFT JOIN v3_section_assignments sa ON sa.sectionId = s.id AND sa.userId = ?
       WHERE s.id = ? AND (s.tutorId = ? OR sa.userId = ?) LIMIT 1`,
      [profesorId, sectionId, profesorId, profesorId]
    )
    return r
  }
  return await db.section.findFirst({
    where: {
      id: sectionId,
      OR: [{ tutorId: profesorId }, { assignments: { some: { userId: profesorId } } }],
    },
    select: { id: true, nombre: true },
  })
}

// GET /api/profesor/feed — lista de publicaciones propias
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'profesor') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  if (isD1()) {
    // Producción: D1
    const posts = await d1Query<{
      id: string
      tipo: string
      contenido: string
      mediaKey: string | null
      createdAt: string
      sectionId: string
      sectionNombre: string
      sectionGrado: string
    }>(
      `SELECT p.id, p.tipo, p.contenido, p.mediaKey, p.createdAt, p.sectionId,
              s.nombre AS sectionNombre, s.grado AS sectionGrado
       FROM v3_feed_posts p
       INNER JOIN v3_sections s ON s.id = p.sectionId
       WHERE p.profesorId = ?
       ORDER BY p.createdAt DESC
       LIMIT 50`,
      [payload.id]
    )

    return NextResponse.json({
      posts: posts.map((p) => ({
        id: p.id,
        tipo: p.tipo,
        contenido: p.contenido,
        mediaKey: p.mediaKey,
        createdAt: p.createdAt,
        section: { nombre: p.sectionNombre, grado: p.sectionGrado },
      })),
    })
  }

  // Desarrollo: Prisma
  const posts = await db.feedPost.findMany({
    where: { profesorId: payload.id },
    include: {
      section: { select: { nombre: true, grado: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      tipo: p.tipo,
      contenido: p.contenido,
      mediaKey: p.mediaKey,
      createdAt: p.createdAt,
      section: p.section,
    })),
  })
}

// POST /api/profesor/feed
// Body: { sectionId, tipo: 'texto'|'foto'|'aviso', contenido, mediaKey? }
export async function POST(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'profesor') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { sectionId, tipo, contenido, mediaKey } = body as {
    sectionId: string
    tipo: string
    contenido: string
    mediaKey?: string
  }

  if (!sectionId || !contenido || !tipo) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  if (!['texto', 'foto', 'aviso'].includes(tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  // Validar acceso a la sección
  const section = await checkSectionAccess(payload.id, sectionId)
  if (!section) {
    return NextResponse.json({ error: 'Sección no autorizada' }, { status: 403 })
  }

  if (isD1()) {
    // Producción: D1
    const newId = uuidv4()
    const nowIso = new Date().toISOString()
    await d1Run(
      `INSERT INTO v3_feed_posts (id, profesorId, sectionId, tipo, contenido, mediaKey, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId, payload.id, sectionId, tipo, contenido, mediaKey || null, nowIso]
    )

    // Crear notificación a cada representante principal de los estudiantes de la sección
    const parents = await d1Query<{ representanteId: string }>(
      `SELECT DISTINCT ps.representanteId
       FROM v3_parent_student ps
       INNER JOIN v3_students st ON st.id = ps.estudianteId
       WHERE ps.esPrincipal = 1 AND st.sectionId = ? AND st.activo = 1`,
      [sectionId]
    )

    const tipoLabel = tipo === 'aviso' ? 'Aviso' : tipo === 'foto' ? 'Foto' : 'Mensaje'
    if (parents.length > 0) {
      const titulo = `${tipoLabel} de la sección ${section.nombre}`
      const mensaje = contenido.length > 120 ? contenido.slice(0, 120) + '…' : contenido
      for (const p of parents) {
        const nId = uuidv4()
        await d1Run(
          `INSERT INTO v3_notifications (id, destinatarioId, tipo, titulo, mensaje, leida, createdAt)
           VALUES (?, ?, 'feed', ?, ?, 0, ?)`,
          [nId, p.representanteId, titulo, mensaje, nowIso]
        )
      }
      // Enviar push notifications a los representantes (fire-and-forget)
      for (const p of parents) {
        sendPushNotification(p.representanteId, {
          title: titulo,
          body: mensaje,
          tipo: 'feed',
          url: '/',
        })
      }
    }

    return NextResponse.json({ ok: true, post: { id: newId } })
  }

  // Desarrollo: Prisma
  const post = await db.feedPost.create({
    data: {
      profesorId: payload.id,
      sectionId,
      tipo,
      contenido,
      mediaKey: mediaKey || null,
    },
  })

  // Crear notificación a cada representante de los estudiantes de la sección
  const parents = await db.parentStudent.findMany({
    where: {
      esPrincipal: true,
      estudiante: { sectionId, activo: true },
    },
    select: { representanteId: true },
    distinct: ['representanteId'],
  })

  const tipoLabel = tipo === 'aviso' ? 'Aviso' : tipo === 'foto' ? 'Foto' : 'Mensaje'
  if (parents.length > 0) {
    await db.notification.createMany({
      data: parents.map((p) => ({
        destinatarioId: p.representanteId,
        tipo: 'feed',
        titulo: `${tipoLabel} de la sección ${section.nombre}`,
        mensaje:
          contenido.length > 120 ? contenido.slice(0, 120) + '…' : contenido,
      })),
    })
    // Enviar push notifications a los representantes (fire-and-forget)
    const pushTitulo = `${tipoLabel} de la sección ${section.nombre}`
    const pushBody = contenido.length > 120 ? contenido.slice(0, 120) + '…' : contenido
    for (const p of parents) {
      sendPushNotification(p.representanteId, {
        title: pushTitulo,
        body: pushBody,
        tipo: 'feed',
        url: '/',
      })
    }
  }

  return NextResponse.json({ ok: true, post: { id: post.id } })
}
