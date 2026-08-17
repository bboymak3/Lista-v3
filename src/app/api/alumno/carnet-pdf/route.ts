import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest, verifyToken } from '@/lib/auth'
import { buildCarnetPdf, fetchStudentDataForCarnet } from '@/lib/carnet-pdf'

// GET /api/alumno/carnet-pdf — genera PDF imprimible del carnet del alumno autenticado.
// Acepta token via Authorization header (Bearer) o query string ?token=... (para window.open / target=_blank).
export async function GET(request: NextRequest) {
  // Auth: header o query param
  let payload = getUserFromRequest(request)
  if (!payload) {
    const token = new URL(request.url).searchParams.get('token')
    if (token) payload = verifyToken(token) || null
  }
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'alumno') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  try {
    // Buscar el Student asociado al usuario
    let studentId: string | null = null
    if (isD1()) {
      const row = await d1First<{ id: string }>(
        'SELECT id FROM v3_students WHERE userId = ? LIMIT 1',
        [payload.id]
      )
      studentId = row?.id ?? null
    } else {
      const student = await db.student.findFirst({
        where: { userId: payload.id },
        select: { id: true },
      })
      studentId = student?.id ?? null
    }

    if (!studentId) {
      return NextResponse.json(
        { error: 'No tienes perfil de estudiante asociado' },
        { status: 404 }
      )
    }

    const student = await fetchStudentDataForCarnet(studentId)
    if (!student) {
      return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })
    }

    const pdfBytes = await buildCarnetPdf(student)

    return new NextResponse(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="carnet-${student.codigoUnico}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    })
  } catch (error) {
    console.error('Alumno carnet PDF error:', error)
    return NextResponse.json({ error: 'Error al generar carnet PDF' }, { status: 500 })
  }
}
