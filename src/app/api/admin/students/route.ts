import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

// GET /api/admin/students — list students (with pagination + filters)
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
  const sectionId = searchParams.get('sectionId') || undefined
  const search = searchParams.get('search') || undefined
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const where: any = {}
  if (!includeInactive) where.activo = true
  if (sectionId) where.sectionId = sectionId
  if (search) {
    where.OR = [
      { nombre: { contains: search } },
      { apellido: { contains: search } },
      { codigoUnico: { contains: search } },
      { cedulaEscolar: { contains: search } },
    ]
  }

  const [students, total] = await Promise.all([
    db.student.findMany({
      where,
      include: {
        section: { select: { id: true, nombre: true, grado: true, turno: true } },
        parents: {
          include: {
            representante: {
              select: { id: true, nombre: true, apellido: true, cedula: true, telefono: true },
            },
          },
        },
      },
      orderBy: { apellido: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.student.count({ where }),
  ])

  return NextResponse.json({
    data: students,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}

// POST /api/admin/students — create a student
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { codigoUnico, cedulaEscolar, nombre, apellido, fechaNacimiento, genero, sectionId } = body

    if (!codigoUnico || !nombre || !apellido || !sectionId) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos (codigoUnico, nombre, apellido, sectionId)' },
        { status: 400 }
      )
    }

    // Verificar que la sección existe
    const section = await db.section.findUnique({ where: { id: sectionId } })
    if (!section) {
      return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
    }

    // Verificar unicidad de codigoUnico
    const existing = await db.student.findUnique({ where: { codigoUnico } })
    if (existing) {
      return NextResponse.json({ error: 'El código único ya existe' }, { status: 409 })
    }

    // Verificar cedulaEscolar única si viene
    if (cedulaEscolar) {
      const existingCedula = await db.student.findUnique({ where: { cedulaEscolar } })
      if (existingCedula) {
        return NextResponse.json({ error: 'La cédula escolar ya está registrada' }, { status: 409 })
      }
    }

    const student = await db.student.create({
      data: {
        codigoUnico,
        cedulaEscolar: cedulaEscolar || null,
        nombre,
        apellido,
        fechaNacimiento: fechaNacimiento || null,
        genero: genero || null,
        sectionId,
        qrCode: uuidv4(),
      },
      include: {
        section: { select: { id: true, nombre: true, grado: true, turno: true } },
      },
    })

    return NextResponse.json(student, { status: 201 })
  } catch (error) {
    console.error('Create student error:', error)
    return NextResponse.json({ error: 'Error al crear estudiante' }, { status: 500 })
  }
}
