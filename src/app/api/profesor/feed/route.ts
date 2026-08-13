import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { sendPushNotification } from '@/lib/push'

// GET /api/profesor/feed — lista de publicaciones propias
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'profesor') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

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
  const section = await db.section.findFirst({
    where: {
      id: sectionId,
      OR: [{ tutorId: payload.id }, { assignments: { some: { userId: payload.id } } }],
    },
    select: { id: true, nombre: true },
  })
  if (!section) {
    return NextResponse.json({ error: 'Sección no autorizada' }, { status: 403 })
  }

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
