import { NextRequest, NextResponse } from 'next/server'
import { isD1, d1Query } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/admin/comparative-stats?plantelId=xxx&metric=section|month
// Compara secciones entre sí, o meses entre sí
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || (user.rol !== 'admin' && user.rol !== 'super_admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const plantelId = searchParams.get('plantelId')
  const metric = searchParams.get('metric') || 'section'

  if (isD1()) {
    if (metric === 'section') {
      // Comparativa por sección (últimos 30 días)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const fromIso = thirtyDaysAgo.toISOString()

      const rows = await d1Query(
        `SELECT
          s.id, s.nombre AS sectionNombre, s.grado,
          COUNT(a.id) AS total,
          SUM(CASE WHEN a.estado = 'presente' THEN 1 ELSE 0 END) AS presentes,
          SUM(CASE WHEN a.estado = 'ausente' THEN 1 ELSE 0 END) AS ausentes,
          SUM(CASE WHEN a.estado = 'tardanza' THEN 1 ELSE 0 END) AS tardanzas
         FROM v3_sections s
         LEFT JOIN v3_attendance a ON a.estudianteId IN (SELECT id FROM v3_students WHERE sectionId = s.id) AND a.fecha >= ?
         ${plantelId ? 'WHERE s.plantelId = ? AND' : 'WHERE'} s.activa = 1
         GROUP BY s.id
         ORDER BY s.grado, s.nombre`,
        plantelId ? [fromIso, plantelId] : [fromIso]
      )

      const sections = rows.map((r: any) => ({
        id: r.id,
        nombre: r.sectionNombre,
        grado: r.grado,
        total: r.total,
        presentes: r.presentes,
        ausentes: r.ausentes,
        tardanzas: r.tardanzas,
        pct: r.total > 0 ? Math.round((r.presentes / r.total) * 100) : 0,
      }))

      return NextResponse.json({ metric: 'section', sections })
    }

    if (metric === 'month') {
      // Comparativa por mes (últimos 6 meses)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      const fromIso = sixMonthsAgo.toISOString()

      const rows = await d1Query(
        `SELECT
          substr(fecha, 1, 7) AS mes,
          COUNT(*) AS total,
          SUM(CASE WHEN estado = 'presente' THEN 1 ELSE 0 END) AS presentes,
          SUM(CASE WHEN estado = 'ausente' THEN 1 ELSE 0 END) AS ausentes,
          SUM(CASE WHEN estado = 'tardanza' THEN 1 ELSE 0 END) AS tardanzas
         FROM v3_attendance
         WHERE fecha >= ?
         ${plantelId ? 'AND estudianteId IN (SELECT st.id FROM v3_students st JOIN v3_sections s ON s.id = st.sectionId WHERE s.plantelId = ?)' : ''}
         GROUP BY substr(fecha, 1, 7)
         ORDER BY mes ASC`,
        plantelId ? [fromIso, plantelId] : [fromIso]
      )

      const months = rows.map((r: any) => ({
        mes: r.mes,
        total: r.total,
        presentes: r.presentes,
        ausentes: r.ausentes,
        tardanzas: r.tardanzas,
        pct: r.total > 0 ? Math.round((r.presentes / r.total) * 100) : 0,
      }))

      return NextResponse.json({ metric: 'month', months })
    }
  }

  return NextResponse.json({ error: 'Solo disponible en producción' }, { status: 501 })
}
