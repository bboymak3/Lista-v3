export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// PUT /api/admin/students/[id] — update student
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
    const { codigoUnico, cedulaEscolar, nombre, apellido, fechaNacimiento, genero, sectionId, activo } = body

    const existing = await db.student.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })
    }

    // Verificar unicidad de codigoUnico si cambia
    if (codigoUnico && codigoUnico !== existing.codigoUnico) {
      const dup = await db.student.findUnique({ where: { codigoUnico } })
      if (dup) {
        return NextResponse.json({ error: 'El código único ya existe' }, { status: 409 })
      }
    }

    // Verificar unicidad de cedulaEscolar si cambia
    if (cedulaEscolar && cedulaEscolar !== existing.cedulaEscolar) {
      const dup = await db.student.findUnique({ where: { cedulaEscolar } })
      if (dup) {
        return NextResponse.json({ error: 'La cédula escolar ya está registrada' }, { status: 409 })
      }
    }

    // Validar sectionId si viene
    if (sectionId && sectionId !== existing.sectionId) {
      const section = await db.section.findUnique({ where: { id: sectionId } })
      if (!section) {
        return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
      }
    }

    const updated = await db.student.update({
      where: { id },
      data: {
        ...(codigoUnico !== undefined && { codigoUnico }),
        ...(cedulaEscolar !== undefined && { cedulaEscolar: cedulaEscolar || null }),
        ...(nombre !== undefined && { nombre }),
        ...(apellido !== undefined && { apellido }),
        ...(fechaNacimiento !== undefined && { fechaNacimiento: fechaNacimiento || null }),
        ...(genero !== undefined && { genero: genero || null }),
        ...(sectionId !== undefined && { sectionId }),
        ...(activo !== undefined && { activo }),
      },
      include: {
        section: { select: { id: true, nombre: true, grado: true, turno: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update student error:', error)
    return NextResponse.json({ error: 'Error al actualizar estudiante' }, { status: 500 })
  }
}

// DELETE /api/admin/students/[id] — soft delete (activo = false)
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
    const existing = await db.student.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })
    }

    await db.student.update({
      where: { id },
      data: { activo: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete student error:', error)
    return NextResponse.json({ error: 'Error al eliminar estudiante' }, { status: 500 })
  }
}
