import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// DELETE /api/admin/representantes/[id]/students/[studentId] — unlink student from representante
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const { id: representanteId, studentId: estudianteId } = await params

    if (isD1()) {
      // Producción: D1
      const existing = await d1First<{ id: string }>(
        'SELECT id FROM v3_parent_student WHERE representanteId = ? AND estudianteId = ? LIMIT 1',
        [representanteId, estudianteId]
      )
      if (!existing) {
        return NextResponse.json(
          { error: 'El estudiante no está asignado a este representante' },
          { status: 404 }
        )
      }
      await d1Run(
        'DELETE FROM v3_parent_student WHERE representanteId = ? AND estudianteId = ?',
        [representanteId, estudianteId]
      )
      return NextResponse.json({ success: true })
    }

    // Desarrollo: Prisma
    const existing = await db.parentStudent.findUnique({
      where: {
        representanteId_estudianteId: { representanteId, estudianteId },
      },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'El estudiante no está asignado a este representante' },
        { status: 404 }
      )
    }

    await db.parentStudent.delete({
      where: {
        representanteId_estudianteId: { representanteId, estudianteId },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unlink student error:', error)
    return NextResponse.json({ error: 'Error al desvincular estudiante' }, { status: 500 })
  }
}
