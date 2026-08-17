import { NextRequest, NextResponse } from 'next/server'
import { isD1, d1Query } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/admin/export/attendance?sectionId=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv|json
// Genera CSV compatible con Excel para el Ministerio de Educación
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || (user.rol !== 'admin' && user.rol !== 'super_admin' && user.rol !== 'profesor')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const sectionId = searchParams.get('sectionId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const format = searchParams.get('format') || 'csv'

  if (!from || !to) {
    return NextResponse.json({ error: 'from y to son requeridos (YYYY-MM-DD)' }, { status: 400 })
  }

  // Fechas: ampliar rango para incluir todo el día
  const fromIso = new Date(from + 'T00:00:00').toISOString()
  const toIso = new Date(to + 'T23:59:59').toISOString()

  let rows: any[] = []

  if (isD1()) {
    if (sectionId) {
      // Estudiantes de una sección específica
      const students = await d1Query<{ id: string; nombre: string; apellido: string; codigoUnico: string; cedulaEscolar: string | null }>(
        `SELECT id, nombre, apellido, codigoUnico, cedulaEscolar
         FROM v3_students WHERE sectionId = ? AND activo = 1
         ORDER BY apellido, nombre`,
        [sectionId]
      )

      // Asistencia de cada estudiante en el rango
      for (const s of students) {
        const records = await d1Query<{ fecha: string; estado: string; origen: string }>(
          `SELECT fecha, estado, origen
           FROM v3_attendance
           WHERE estudianteId = ? AND fecha >= ? AND fecha <= ?
           ORDER BY fecha ASC`,
          [s.id, fromIso, toIso]
        )
        rows.push({ student: s, records })
      }
    } else {
      // Todos los estudiantes (sin filtro de sección)
      const students = await d1Query<{ id: string; nombre: string; apellido: string; codigoUnico: string; cedulaEscolar: string | null; sectionNombre: string; sectionGrado: string }>(
        `SELECT st.id, st.nombre, st.apellido, st.codigoUnico, st.cedulaEscolar,
                s.nombre AS sectionNombre, s.grado AS sectionGrado
         FROM v3_students st
         JOIN v3_sections s ON s.id = st.sectionId
         WHERE st.activo = 1
         ORDER BY st.apellido, st.nombre`,
        []
      )

      for (const s of students) {
        const records = await d1Query<{ fecha: string; estado: string }>(
          `SELECT fecha, estado FROM v3_attendance WHERE estudianteId = ? AND fecha >= ? AND fecha <= ? ORDER BY fecha ASC`,
          [s.id, fromIso, toIso]
        )
        rows.push({ student: s, records })
      }
    }
  } else {
    const { db } = await import('@/lib/db-dev')
    const where: any = { activo: true }
    if (sectionId) where.sectionId = sectionId
    const students = await db.student.findMany({
      where,
      include: {
        section: { select: { nombre: true, grado: true } },
        attendance: {
          where: { fecha: { gte: new Date(fromIso), lte: new Date(toIso) } },
          orderBy: { fecha: 'asc' }
        }
      },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }]
    })
    rows = students.map(s => ({
      student: { id: s.id, nombre: s.nombre, apellido: s.apellido, codigoUnico: s.codigoUnico, cedulaEscolar: s.cedulaEscolar, sectionNombre: s.section.nombre, sectionGrado: s.section.grado },
      records: s.attendance.map(a => ({ fecha: a.fecha.toISOString(), estado: a.estado, origen: a.origen }))
    }))
  }

  if (format === 'json') {
    return NextResponse.json({ from, to, sectionId, rows })
  }

  // Generar CSV
  const escape = (v: any) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }

  // Cabecera
  const headers = [
    'Cédula Escolar', 'Código Único', 'Apellidos', 'Nombres',
    'Sección', 'Grado',
    'Total Clases', 'Presentes', 'Ausentes', 'Tardanzas', 'Justificados',
    '% Asistencia'
  ]

  // Generar lista de fechas únicas para columnas dinámicas
  const fechasSet = new Set<string>()
  for (const r of rows) {
    for (const rec of r.records) {
      fechasSet.add(rec.fecha.substring(0, 10))
    }
  }
  const fechas = Array.from(fechasSet).sort()
  const allHeaders = [...headers, ...fechas.map(f => {
    const [y, m, d] = f.split('-')
    return `${d}/${m}/${y}`
  })]

  const csvRows: string[] = [allHeaders.map(escape).join(',')]

  for (const r of rows) {
    const s = r.student
    const total = r.records.length
    const presentes = r.records.filter((x: any) => x.estado === 'presente').length
    const ausentes = r.records.filter((x: any) => x.estado === 'ausente').length
    const tardanzas = r.records.filter((x: any) => x.estado === 'tardanza').length
    const justificados = r.records.filter((x: any) => x.estado === 'justificado').length
    const pct = total > 0 ? Math.round((presentes / total) * 100) : 0

    const row: any[] = [
      s.cedulaEscolar || '',
      s.codigoUnico,
      s.apellido,
      s.nombre,
      s.sectionNombre || '',
      s.sectionGrado || '',
      total,
      presentes,
      ausentes,
      tardanzas,
      justificados,
      pct + '%'
    ]

    // Marcar cada fecha con P/A/T/J/-
    for (const f of fechas) {
      const rec = r.records.find((x: any) => x.fecha.substring(0, 10) === f)
      if (rec) {
        row.push(rec.estado === 'presente' ? 'P' :
                 rec.estado === 'ausente' ? 'A' :
                 rec.estado === 'tardanza' ? 'T' :
                 rec.estado === 'justificado' ? 'J' : '-')
      } else {
        row.push('-')
      }
    }

    csvRows.push(row.map(escape).join(','))
  }

  const csv = '\uFEFF' + csvRows.join('\n') // BOM para Excel
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="asistencia_${from}_a_${to}.csv"`,
    }
  })
}
