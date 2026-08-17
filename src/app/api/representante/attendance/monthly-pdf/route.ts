import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Query } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { buildMonthlyAttendancePdf } from '@/lib/pdf-monthly'

// GET /api/representante/attendance/monthly-pdf?estudianteId=xxx&month=YYYY-MM
// Generates a PDF report with the monthly attendance summary for the student.
export async function GET(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'representante') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const estudianteId = searchParams.get('estudianteId')
  const monthParam = searchParams.get('month') // YYYY-MM

  if (!estudianteId) {
    return NextResponse.json(
      { error: 'Parámetro estudianteId requerido' },
      { status: 400 }
    )
  }
  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json(
      { error: 'Parámetro month inválido (formato YYYY-MM)' },
      { status: 400 }
    )
  }

  // Parse month range
  const [year, month] = monthParam.split('-').map((n) => parseInt(n, 10))
  if (month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'Mes inválido' },
      { status: 400 }
    )
  }
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
  const endOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0)) // exclusive

  let studentInfo: {
    nombre: string
    apellido: string
    cedulaEscolar: string | null
    codigoUnico: string
    sectionNombre: string
    sectionGrado: string
    sectionTurno: string
    plantelNombre: string
    plantelDireccion: string | null
  } | null = null
  let records: { fecha: string; estado: string; origen: string }[] = []

  if (isD1()) {
    // Producción: D1 — verificar ownership via ParentStudent
    const link = await d1First<{ id: string }>(
      'SELECT id FROM v3_parent_student WHERE representanteId = ? AND estudianteId = ? LIMIT 1',
      [payload.id, estudianteId]
    )
    if (!link) {
      return NextResponse.json(
        { error: 'No autorizado para este estudiante' },
        { status: 403 }
      )
    }

    const student = await d1First<{
      nombre: string
      apellido: string
      cedulaEscolar: string | null
      codigoUnico: string
      sectionNombre: string
      sectionGrado: string
      sectionTurno: string
      plantelNombre: string
      plantelDireccion: string | null
    }>(
      `SELECT s.nombre, s.apellido, s.cedulaEscolar, s.codigoUnico,
              sec.nombre AS sectionNombre, sec.grado AS sectionGrado, sec.turno AS sectionTurno,
              p.nombre AS plantelNombre, p.direccion AS plantelDireccion
       FROM v3_students s
       INNER JOIN v3_sections sec ON sec.id = s.sectionId
       INNER JOIN v3_plantels p ON p.id = sec.plantelId
       WHERE s.id = ? LIMIT 1`,
      [estudianteId]
    )
    if (!student) {
      return NextResponse.json(
        { error: 'Estudiante no encontrado' },
        { status: 404 }
      )
    }
    studentInfo = student

    records = await d1Query<{ fecha: string; estado: string; origen: string }>(
      `SELECT fecha, estado, origen
       FROM v3_attendance
       WHERE estudianteId = ? AND fecha >= ? AND fecha < ?
       ORDER BY fecha ASC`,
      [estudianteId, startOfMonth.toISOString(), endOfMonth.toISOString()]
    )
  } else {
    // Desarrollo: Prisma
    const link = await db.parentStudent.findUnique({
      where: {
        representanteId_estudianteId: { representanteId: payload.id, estudianteId },
      },
      select: { id: true },
    })
    if (!link) {
      return NextResponse.json(
        { error: 'No autorizado para este estudiante' },
        { status: 403 }
      )
    }

    const student = await db.student.findUnique({
      where: { id: estudianteId },
      select: {
        nombre: true,
        apellido: true,
        cedulaEscolar: true,
        codigoUnico: true,
        section: {
          select: {
            nombre: true,
            grado: true,
            turno: true,
            plantel: { select: { nombre: true, direccion: true } },
          },
        },
      },
    })
    if (!student) {
      return NextResponse.json(
        { error: 'Estudiante no encontrado' },
        { status: 404 }
      )
    }
    studentInfo = {
      nombre: student.nombre,
      apellido: student.apellido,
      cedulaEscolar: student.cedulaEscolar,
      codigoUnico: student.codigoUnico,
      sectionNombre: student.section.nombre,
      sectionGrado: student.section.grado,
      sectionTurno: student.section.turno,
      plantelNombre: student.section.plantel.nombre,
      plantelDireccion: student.section.plantel.direccion,
    }

    const attRecords = await db.attendance.findMany({
      where: {
        estudianteId,
        fecha: { gte: startOfMonth, lt: endOfMonth },
      },
      select: { fecha: true, estado: true, origen: true },
      orderBy: { fecha: 'asc' },
    })
    records = attRecords.map((r) => ({
      fecha: r.fecha.toISOString(),
      estado: r.estado,
      origen: r.origen,
    }))
  }

  // Stats
  const total = records.length
  const presentes = records.filter((r) => r.estado === 'presente').length
  const ausentes = records.filter((r) => r.estado === 'ausente').length
  const tardanzas = records.filter((r) => r.estado === 'tardanza').length
  const justificados = records.filter((r) => r.estado === 'justificado').length
  const pct = total > 0 ? Math.round((presentes / total) * 100) : 0

  const pdfBytes = await buildMonthlyAttendancePdf({
    student: studentInfo!,
    month: monthParam,
    stats: { total, presentes, ausentes, tardanzas, justificados, pct },
    records,
    generatedAt: new Date(),
  })

  const filename = `asistencia-${studentInfo!.codigoUnico}-${monthParam}.pdf`

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
