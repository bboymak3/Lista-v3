import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// PUT /api/admin/sections/[id] — update section (assign tutor, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { nombre, grado, turno, plantelId, tutorId, activa } = body

    const existing = await db.section.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
    }

    if (plantelId && plantelId !== existing.plantelId) {
      const plantel = await db.plantel.findUnique({ where: { id: plantelId } })
      if (!plantel) {
        return NextResponse.json({ error: 'Plantel no encontrado' }, { status: 404 })
      }
    }

    if (tutorId) {
      const tutor = await db.user.findUnique({ where: { id: tutorId } })
      if (!tutor || tutor.rol !== 'profesor') {
        return NextResponse.json({ error: 'Tutor inválido o no es profesor' }, { status: 400 })
      }
    }

    const updated = await db.section.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(grado !== undefined && { grado }),
        ...(turno !== undefined && { turno }),
        ...(plantelId !== undefined && { plantelId }),
        ...(tutorId !== undefined && { tutorId: tutorId || null }),
        ...(activa !== undefined && { activa }),
      },
      include: {
        plantel: { select: { id: true, nombre: true } },
        tutor: { select: { id: true, nombre: true, apellido: true, cedula: true } },
      },
    })

    // Sincronizar SectionAssignment con el tutor
    if (tutorId !== undefined) {
      if (tutorId) {
        await db.sectionAssignment.upsert({
          where: { sectionId_userId: { sectionId: id, userId: tutorId } },
          update: { role: 'tutor' },
          create: { sectionId: id, userId: tutorId, role: 'tutor' },
        })
      }
      // Eliminar asignaciones previas de tutor distinto al nuevo
      await db.sectionAssignment.deleteMany({
        where: { sectionId: id, role: 'tutor', ...(tutorId ? { NOT: { userId: tutorId } } : {}) },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update section error:', error)
    return NextResponse.json({ error: 'Error al actualizar sección' }, { status: 500 })
  }
}

// DELETE /api/admin/sections/[id] — soft delete (activa = false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const { id } = await params
    const existing = await db.section.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
    }

    await db.section.update({
      where: { id },
      data: { activa: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete section error:', error)
    return NextResponse.json({ error: 'Error al eliminar sección' }, { status: 500 })
  }
}
