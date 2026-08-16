import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1Query } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/representante/feed
// Lista FeedPosts de TODAS las secciones de los hijos del representante.
// Incluye nombre del profesor, sección y mediaKey. Ordenado por createdAt desc, límite 50.
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'representante') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  if (isD1()) {
    // Producción: D1
    // Recopilar sectionIds de todos los hijos del representante
    const links = await d1Query<{ sectionId: string }>(
      `SELECT DISTINCT st.sectionId
       FROM v3_parent_student ps
       INNER JOIN v3_students st ON st.id = ps.estudianteId
       WHERE ps.representanteId = ?`,
      [payload.id]
    )

    const sectionIds = links.map((l) => l.sectionId)

    if (sectionIds.length === 0) {
      return NextResponse.json({ posts: [], sections: [] })
    }

    // Generar placeholders dinámicos para IN (...)
    const placeholders = sectionIds.map(() => '?').join(', ')

    const sections = await d1Query<{ id: string; nombre: string; grado: string; turno: string }>(
      `SELECT id, nombre, grado, turno FROM v3_sections WHERE id IN (${placeholders})`,
      sectionIds
    )

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
      sectionId: string
      sectionNombre: string
    }>(
      `SELECT p.id, p.tipo, p.contenido, p.mediaKey, p.createdAt,
              p.profesorId, u.nombre AS profesorNombre, u.apellido AS profesorApellido, u.fotoKey AS profesorFotoKey,
              p.sectionId, s.nombre AS sectionNombre
       FROM v3_feed_posts p
       INNER JOIN v3_users u ON u.id = p.profesorId
       INNER JOIN v3_sections s ON s.id = p.sectionId
       WHERE p.sectionId IN (${placeholders})
       ORDER BY p.createdAt DESC
       LIMIT 50`,
      [...sectionIds, ...sectionIds]
    )

    const result = posts.map((p) => ({
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
        id: p.sectionId,
        nombre: p.sectionNombre,
      },
    }))

    return NextResponse.json({
      posts: result,
      sections: sections.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        grado: s.grado,
        turno: s.turno,
      })),
    })
  }

  // Desarrollo: Prisma
  // Recopilar sectionIds de todos los hijos del representante
  const links = await db.parentStudent.findMany({
    where: { representanteId: payload.id },
    select: { estudiante: { select: { sectionId: true } } },
  })

  const sectionIds = Array.from(
    new Set(links.map((l) => l.estudiante.sectionId))
  )

  if (sectionIds.length === 0) {
    return NextResponse.json({ posts: [], sections: [] })
  }

  const sections = await db.section.findMany({
    where: { id: { in: sectionIds } },
    select: { id: true, nombre: true, grado: true, turno: true },
  })

  const posts = await db.feedPost.findMany({
    where: { sectionId: { in: sectionIds } },
    include: {
      profesor: {
        select: { id: true, nombre: true, apellido: true, fotoKey: true },
      },
      section: {
        select: { id: true, nombre: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const result = posts.map((p) => ({
    id: p.id,
    tipo: p.tipo,
    contenido: p.contenido,
    mediaKey: p.mediaKey,
    createdAt: p.createdAt,
    profesor: {
      id: p.profesor.id,
      nombre: p.profesor.nombre,
      apellido: p.profesor.apellido,
      fotoKey: p.profesor.fotoKey,
    },
    section: {
      id: p.section.id,
      nombre: p.section.nombre,
    },
  }))

  return NextResponse.json({
    posts: result,
    sections: sections.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      grado: s.grado,
      turno: s.turno,
    })),
  })
}
