import { NextRequest, NextResponse } from 'next/server'
import { isD1, d1Query } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/admin/attendance-alerts?plantelId=xxx
// Detecta estudiantes con <75% asistencia en últimos 30 días
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || (user.rol !== 'admin' && user.rol !== 'super_admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const plantelId = searchParams.get('plantelId')

  // Fecha de hace 30 días
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const fromIso = thirtyDaysAgo.toISOString()

  if (isD1()) {
    // Por estudiante: presentes / total
    const rows = await d1Query<{
      estudianteId: string; nombre: string; apellido: string; codigoUnico: string;
      sectionNombre: string; total: number; presentes: number; ausentes: number; tardanzas: number
    }>(
      `SELECT
        st.id AS estudianteId, st.nombre, st.apellido, st.codigoUnico,
        s.nombre AS sectionNombre,
        COUNT(a.id) AS total,
        SUM(CASE WHEN a.estado = 'presente' THEN 1 ELSE 0 END) AS presentes,
        SUM(CASE WHEN a.estado = 'ausente' THEN 1 ELSE 0 END) AS ausentes,
        SUM(CASE WHEN a.estado = 'tardanza' THEN 1 ELSE 0 END) AS tardanzas
       FROM v3_students st
       LEFT JOIN v3_attendance a ON a.estudianteId = st.id AND a.fecha >= ?
       JOIN v3_sections s ON s.id = st.sectionId
       ${plantelId ? 'WHERE s.plantelId = ? AND' : 'WHERE'} st.activo = 1
       GROUP BY st.id
       HAVING total > 0 AND (CAST(presentes AS FLOAT) / total) < 0.75
       ORDER BY (CAST(presentes AS FLOAT) / total) ASC
       LIMIT 20`,
      plantelId ? [fromIso, plantelId] : [fromIso]
    )

    const alerts = rows.map(r => ({
      ...r,
      pct: r.total > 0 ? Math.round((r.presentes / r.total) * 100) : 0,
    }))

    return NextResponse.json({ alerts, total: alerts.length })
  }

  const { db } = await import('@/lib/db-dev')
  const students = await db.student.findMany({
    where: { activo: true, ...(plantelId ? { section: { plantelId } } : {}) },
    include: {
      section: { select: { nombre: true } },
      attendance: { where: { fecha: { gte: thirtyDaysAgo } }, select: { estado: true } }
    }
  })

  const alerts = students
    .map(s => {
      const total = s.attendance.length
      const presentes = s.attendance.filter(a => a.estado === 'presente').length
      return {
        estudianteId: s.id,
        nombre: s.nombre,
        apellido: s.apellido,
        codigoUnico: s.codigoUnico,
        sectionNombre: s.section.nombre,
        total,
        presentes,
        ausentes: s.attendance.filter(a => a.estado === 'ausente').length,
        tardanzas: s.attendance.filter(a => a.estado === 'tardanza').length,
        pct: total > 0 ? Math.round((presentes / total) * 100) : 0,
      }
    })
    .filter(s => s.total > 0 && s.pct < 75)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 20)

  return NextResponse.json({ alerts, total: alerts.length })
}
