import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

// PUT /api/admin/students/[id] — update student
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { codigoUnico, cedulaEscolar, nombre, apellido, fechaNacimiento, genero, sectionId, activo } = body

    if (isD1()) {
      // Producción: D1
      const existing = await d1First<{
        id: string
        codigoUnico: string
        cedulaEscolar: string | null
        sectionId: string
      }>('SELECT id, codigoUnico, cedulaEscolar, sectionId FROM v3_students WHERE id = ? LIMIT 1', [id])
      if (!existing) {
        return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })
      }

      // Verificar unicidad de codigoUnico si cambia
      if (codigoUnico && codigoUnico !== existing.codigoUnico) {
        const dup = await d1First<{ id: string }>(
          'SELECT id FROM v3_students WHERE codigoUnico = ? AND id != ? LIMIT 1',
          [codigoUnico, id]
        )
        if (dup) {
          return NextResponse.json({ error: 'El código único ya existe' }, { status: 409 })
        }
      }

      // Verificar unicidad de cedulaEscolar si cambia
      if (cedulaEscolar && cedulaEscolar !== existing.cedulaEscolar) {
        const dup = await d1First<{ id: string }>(
          'SELECT id FROM v3_students WHERE cedulaEscolar = ? AND id != ? LIMIT 1',
          [cedulaEscolar, id]
        )
        if (dup) {
          return NextResponse.json({ error: 'La cédula escolar ya está registrada' }, { status: 409 })
        }
      }

      // Validar sectionId si viene
      if (sectionId && sectionId !== existing.sectionId) {
        const section = await d1First<{ id: string }>(
          'SELECT id FROM v3_sections WHERE id = ? LIMIT 1',
          [sectionId]
        )
        if (!section) {
          return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
        }
      }

      // Construir SET dinámico
      const sets: string[] = []
      const sqlParams: unknown[] = []
      if (codigoUnico !== undefined) { sets.push('codigoUnico = ?'); sqlParams.push(codigoUnico) }
      if (cedulaEscolar !== undefined) { sets.push('cedulaEscolar = ?'); sqlParams.push(cedulaEscolar || null) }
      if (nombre !== undefined) { sets.push('nombre = ?'); sqlParams.push(nombre) }
      if (apellido !== undefined) { sets.push('apellido = ?'); sqlParams.push(apellido) }
      if (fechaNacimiento !== undefined) { sets.push('fechaNacimiento = ?'); sqlParams.push(fechaNacimiento || null) }
      if (genero !== undefined) { sets.push('genero = ?'); sqlParams.push(genero || null) }
      if (sectionId !== undefined) { sets.push('sectionId = ?'); sqlParams.push(sectionId) }
      if (activo !== undefined) { sets.push('activo = ?'); sqlParams.push(activo ? 1 : 0) }
      sets.push('updatedAt = ?')
      sqlParams.push(new Date().toISOString())
      sqlParams.push(id)

      if (sets.length > 1) {
        await d1Run(`UPDATE v3_students SET ${sets.join(', ')} WHERE id = ?`, sqlParams)
      }

      // Recuperar el actualizado + sección
      const updated = await d1First<{
        id: string
        codigoUnico: string
        cedulaEscolar: string | null
        nombre: string
        apellido: string
        fechaNacimiento: string | null
        genero: string | null
        sectionId: string
        qrCode: string
        activo: number
        sectionId_section: string
        sectionNombre: string
        sectionGrado: string
        sectionTurno: string
      }>(
        `SELECT s.*, sec.id AS sectionId_section, sec.nombre AS sectionNombre, sec.grado AS sectionGrado, sec.turno AS sectionTurno
         FROM v3_students s
         LEFT JOIN v3_sections sec ON sec.id = s.sectionId
         WHERE s.id = ? LIMIT 1`,
        [id]
      )

      return NextResponse.json({
        id: updated?.id,
        codigoUnico: updated?.codigoUnico,
        cedulaEscolar: updated?.cedulaEscolar,
        nombre: updated?.nombre,
        apellido: updated?.apellido,
        fechaNacimiento: updated?.fechaNacimiento,
        genero: updated?.genero,
        sectionId: updated?.sectionId,
        qrCode: updated?.qrCode,
        activo: updated?.activo === 1,
        section: updated?.sectionId_section
          ? {
              id: updated.sectionId_section,
              nombre: updated.sectionNombre,
              grado: updated.sectionGrado,
              turno: updated.sectionTurno,
            }
          : null,
      })
    }

    // Desarrollo: Prisma
    const existing = await db.student.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })
    }

    // Verificar unicidad de codigoUnico si cambia
    if (codigoUnico && codigoUnico !== existing.codigoUnico) {
      const dup = await db.student.findUnique({ where: { codigoUnico } })
      if (dup) {
        return NextResponse.json({ error: 'El código único ya existe' }, { status: 409 })
      }
    }

    // Verificar unicidad de cedulaEscolar si cambia
    if (cedulaEscolar && cedulaEscolar !== existing.cedulaEscolar) {
      const dup = await db.student.findUnique({ where: { cedulaEscolar } })
      if (dup) {
        return NextResponse.json({ error: 'La cédula escolar ya está registrada' }, { status: 409 })
      }
    }

    // Validar sectionId si viene
    if (sectionId && sectionId !== existing.sectionId) {
      const section = await db.section.findUnique({ where: { id: sectionId } })
      if (!section) {
        return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
      }
    }

    const updated = await db.student.update({
      where: { id },
      data: {
        ...(codigoUnico !== undefined && { codigoUnico }),
        ...(cedulaEscolar !== undefined && { cedulaEscolar: cedulaEscolar || null }),
        ...(nombre !== undefined && { nombre }),
        ...(apellido !== undefined && { apellido }),
        ...(fechaNacimiento !== undefined && { fechaNacimiento: fechaNacimiento || null }),
        ...(genero !== undefined && { genero: genero || null }),
        ...(sectionId !== undefined && { sectionId }),
        ...(activo !== undefined && { activo }),
      },
      include: {
        section: { select: { id: true, nombre: true, grado: true, turno: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update student error:', error)
    return NextResponse.json({ error: 'Error al actualizar estudiante' }, { status: 500 })
  }
}

// DELETE /api/admin/students/[id] — soft delete (activo = false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const { id } = await params

    if (isD1()) {
      // Producción: D1
      const existing = await d1First<{ id: string }>(
        'SELECT id FROM v3_students WHERE id = ? LIMIT 1',
        [id]
      )
      if (!existing) {
        return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })
      }
      await d1Run('UPDATE v3_students SET activo = 0, updatedAt = ? WHERE id = ?', [
        new Date().toISOString(),
        id,
      ])
      return NextResponse.json({ success: true })
    }

    // Desarrollo: Prisma
    const existing = await db.student.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 })
    }

    await db.student.update({
      where: { id },
      data: { activo: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete student error:', error)
    return NextResponse.json({ error: 'Error al eliminar estudiante' }, { status: 500 })
  }
}
