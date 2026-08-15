export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/alumno/feed — publicaciones de la sección del alumno
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'alumno') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const student = await db.student.findUnique({
    where: { userId: payload.id },
    select: { sectionId: true },
  })
  if (!student) {
    return NextResponse.json({ error: 'Perfil de estudiante no encontrado' }, { status: 404 })
  }

  const posts = await db.feedPost.findMany({
    where: { sectionId: student.sectionId },
    include: {
      profesor: {
        select: { id: true, nombre: true, apellido: true, fotoKey: true },
      },
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
      profesor: p.profesor,
      section: p.section,
    })),
  })
}
