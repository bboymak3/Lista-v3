import { NextRequest, NextResponse } from 'next/server'
import { isD1, d1Query } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/super-admin/plantels/[id]/students
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const { id } = await params

  if (isD1()) {
    const students = await d1Query(
      `SELECT st.id, st.nombre, st.apellido, st.codigoUnico, st.cedulaEscolar,
              s.nombre AS sectionName, s.grado
       FROM v3_students st
       JOIN v3_sections s ON s.id = st.sectionId
       WHERE s.plantelId = ? AND st.activo = 1
       ORDER BY st.apellido, st.nombre`,
      [id]
    )
    return NextResponse.json({ students })
  }

  const { db } = await import('@/lib/db-dev')
  const students = await db.student.findMany({
    where: { section: { plantelId: id }, activo: true },
    include: { section: { select: { nombre: true, grado: true } } },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }]
  })
  return NextResponse.json({
    students: students.map(s => ({
      id: s.id, nombre: s.nombre, apellido: s.apellido, codigoUnico: s.codigoUnico,
      cedulaEscolar: s.cedulaEscolar, sectionName: s.section.nombre, grado: s.section.grado
    }))
  })
}
