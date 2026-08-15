export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/admin/sections — list sections with plantel, tutor, studentCount
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const plantelId = searchParams.get('plantelId') || undefined
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const where: any = {}
  if (!includeInactive) where.activa = true
  if (plantelId) where.plantelId = plantelId

  const sections = await db.section.findMany({
    where,
    include: {
      plantel: { select: { id: true, nombre: true } },
      tutor: { select: { id: true, nombre: true, apellido: true, cedula: true } },
      _count: { select: { students: true } },
    },
    orderBy: [{ grado: 'asc' }, { nombre: 'asc' }],
  })

  const result = sections.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    grado: s.grado,
    turno: s.turno,
    plantelId: s.plantelId,
    plantel: s.plantel,
    tutorId: s.tutorId,
    tutor: s.tutor,
    periodoEscolar: s.periodoEscolar,
    activa: s.activa,
    studentCount: s._count.students,
  }))

  return NextResponse.json({ data: result })
}

// POST /api/admin/sections — create section
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { nombre, grado, turno, plantelId, tutorId } = body

    if (!nombre || !grado || !turno || !plantelId) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (nombre, grado, turno, plantelId)' },
        { status: 400 }
      )
    }

    const plantel = await db.plantel.findUnique({ where: { id: plantelId } })
    if (!plantel) {
      return NextResponse.json({ error: 'Plantel no encontrado' }, { status: 404 })
    }

    if (tutorId) {
      const tutor = await db.user.findUnique({ where: { id: tutorId } })
      if (!tutor || tutor.rol !== 'profesor') {
        return NextResponse.json({ error: 'Tutor inválido o no es profesor' }, { status: 400 })
      }
    }

    const section = await db.section.create({
      data: {
        nombre,
        grado,
        turno,
        plantelId,
        tutorId: tutorId || null,
        periodoEscolar: plantel.periodoActual,
      },
      include: {
        plantel: { select: { id: true, nombre: true } },
        tutor: { select: { id: true, nombre: true, apellido: true, cedula: true } },
      },
    })

    // Si hay tutor, crear SectionAssignment
    if (tutorId) {
      await db.sectionAssignment.upsert({
        where: { sectionId_userId: { sectionId: section.id, userId: tutorId } },
        update: { role: 'tutor' },
        create: { sectionId: section.id, userId: tutorId, role: 'tutor' },
      })
    }

    return NextResponse.json(section, { status: 201 })
  } catch (error) {
    console.error('Create section error:', error)
    return NextResponse.json({ error: 'Error al crear sección' }, { status: 500 })
  }
}
