import { NextRequest, NextResponse } from 'next/server'

import { getUserFromRequest, verifyToken } from '@/lib/auth'
import { buildCarnetPdf, fetchStudentDataForCarnet } from '@/lib/carnet-pdf'

// GET /api/admin/students/[id]/carnet-pdf — genera PDF imprimible del carnet del estudiante.
// Acepta token via Authorization header (Bearer) o query string ?token=... (para window.open / target=_blank).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth: header o query param
  let payload = getUserFromRequest(request)
  if (!payload) {
    const token = new URL(request.url).searchParams.get('token')
    if (token) payload = verifyToken(token) || null
  }
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (payload.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const student = await fetchStudentDataForCarnet(id)
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
    console.error('Carnet PDF error:', error)
    return NextResponse.json({ error: 'Error al generar carnet PDF' }, { status: 500 })
  }
}
