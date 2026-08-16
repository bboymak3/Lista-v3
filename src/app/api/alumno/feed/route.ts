import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Query } from '@/lib/d1'
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

  if (isD1()) {
    // Producción: D1
    const student = await d1First<{ sectionId: string }>(
      'SELECT sectionId FROM v3_students WHERE userId = ? LIMIT 1',
      [payload.id]
    )
    if (!student) {
      return NextResponse.json({ error: 'Perfil de estudiante no encontrado' }, { status: 404 })
    }

    const posts = await d1Query<{
      id: string
      tipo: string
      contenido: string
      mediaKey: string | null
      createdAt: string
      profesorId: string
      profesorNombre: string
      profesorApellido: string
      profesorFotoKey: string | null
      sectionNombre: string
      sectionGrado: string
    }>(
      `SELECT p.id, p.tipo, p.contenido, p.mediaKey, p.createdAt,
              p.profesorId, u.nombre AS profesorNombre, u.apellido AS profesorApellido, u.fotoKey AS profesorFotoKey,
              s.nombre AS sectionNombre, s.grado AS sectionGrado
       FROM v3_feed_posts p
       INNER JOIN v3_users u ON u.id = p.profesorId
       INNER JOIN v3_sections s ON s.id = p.sectionId
       WHERE p.sectionId = ?
       ORDER BY p.createdAt DESC
       LIMIT 50`,
      [student.sectionId]
    )

    return NextResponse.json({
      posts: posts.map((p) => ({
        id: p.id,
        tipo: p.tipo,
        contenido: p.contenido,
        mediaKey: p.mediaKey,
        createdAt: p.createdAt,
        profesor: {
          id: p.profesorId,
          nombre: p.profesorNombre,
          apellido: p.profesorApellido,
          fotoKey: p.profesorFotoKey,
        },
        section: {
          nombre: p.sectionNombre,
          grado: p.sectionGrado,
        },
      })),
    })
  }

  // Desarrollo: Prisma
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
