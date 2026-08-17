import { NextRequest, NextResponse } from 'next/server'
import { isD1, d1Query } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/super-admin/plantels/[id]/sections
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const { id } = await params

  if (isD1()) {
    const sections = await d1Query(
      `SELECT id, nombre, grado, turno, activa, periodoEscolar
       FROM v3_sections WHERE plantelId = ? ORDER BY grado, nombre`,
      [id]
    )
    return NextResponse.json({ sections })
  }

  const { db } = await import('@/lib/db-dev')
  const sections = await db.section.findMany({
    where: { plantelId: id },
    orderBy: [{ grado: 'asc' }, { nombre: 'asc' }]
  })
  return NextResponse.json({
    sections: sections.map(s => ({
      ...s, activa: s.activa ? 1 : 0
    }))
  })
}
