import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

// PUT /api/admin/sections/[id] — update section (assign tutor, etc.)
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
    const { nombre, grado, turno, plantelId, tutorId, activa } = body

    if (isD1()) {
      // Producción: D1
      const existing = await d1First<{ id: string; plantelId: string; tutorId: string | null }>(
        'SELECT id, plantelId, tutorId FROM v3_sections WHERE id = ? LIMIT 1',
        [id]
      )
      if (!existing) {
        return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
      }

      if (plantelId && plantelId !== existing.plantelId) {
        const plantel = await d1First<{ id: string }>(
          'SELECT id FROM v3_plantels WHERE id = ? LIMIT 1',
          [plantelId]
        )
        if (!plantel) {
          return NextResponse.json({ error: 'Plantel no encontrado' }, { status: 404 })
        }
      }

      if (tutorId) {
        const tutor = await d1First<{ id: string; rol: string }>(
          'SELECT id, rol FROM v3_users WHERE id = ? LIMIT 1',
          [tutorId]
        )
        if (!tutor || tutor.rol !== 'profesor') {
          return NextResponse.json({ error: 'Tutor inválido o no es profesor' }, { status: 400 })
        }
      }

      const sets: string[] = []
      const sqlParams: unknown[] = []
      if (nombre !== undefined) { sets.push('nombre = ?'); sqlParams.push(nombre) }
      if (grado !== undefined) { sets.push('grado = ?'); sqlParams.push(grado) }
      if (turno !== undefined) { sets.push('turno = ?'); sqlParams.push(turno) }
      if (plantelId !== undefined) { sets.push('plantelId = ?'); sqlParams.push(plantelId) }
      if (tutorId !== undefined) { sets.push('tutorId = ?'); sqlParams.push(tutorId || null) }
      if (activa !== undefined) { sets.push('activa = ?'); sqlParams.push(activa ? 1 : 0) }
      sets.push('updatedAt = ?')
      sqlParams.push(new Date().toISOString())
      sqlParams.push(id)

      if (sets.length > 1) {
        await d1Run(`UPDATE v3_sections SET ${sets.join(', ')} WHERE id = ?`, sqlParams)
      }

      // Sincronizar SectionAssignment con el tutor
      if (tutorId !== undefined) {
        if (tutorId) {
          const existingAssignment = await d1First<{ id: string }>(
            'SELECT id FROM v3_section_assignments WHERE sectionId = ? AND userId = ? LIMIT 1',
            [id, tutorId]
          )
          if (existingAssignment) {
            await d1Run('UPDATE v3_section_assignments SET role = ? WHERE id = ?', [
              'tutor',
              existingAssignment.id,
            ])
          } else {
            const aId = uuidv4()
            await d1Run(
              'INSERT INTO v3_section_assignments (id, sectionId, userId, role, createdAt) VALUES (?, ?, ?, ?, ?)',
              [aId, id, tutorId, 'tutor', new Date().toISOString()]
            )
          }
          // Eliminar asignaciones previas de tutor distinto al nuevo
          await d1Run(
            "DELETE FROM v3_section_assignments WHERE sectionId = ? AND role = 'tutor' AND userId != ?",
            [id, tutorId]
          )
        } else {
          // Sin tutor — eliminar todas las asignaciones de tutor
          await d1Run(
            "DELETE FROM v3_section_assignments WHERE sectionId = ? AND role = 'tutor'",
            [id]
          )
        }
      }

      // Recuperar actualizado + plantel + tutor
      const updated = await d1First<{
        id: string
        nombre: string
        grado: string
        turno: string
        plantelId: string
        tutorId: string | null
        periodoEscolar: string
        activa: number
        plantelNombre: string
        tutorNombre: string
        tutorApellido: string
        tutorCedula: string
      }>(
        `SELECT s.id, s.nombre, s.grado, s.turno, s.plantelId, s.tutorId, s.periodoEscolar, s.activa,
                p.nombre AS plantelNombre,
                u.nombre AS tutorNombre, u.apellido AS tutorApellido, u.cedula AS tutorCedula
         FROM v3_sections s
         LEFT JOIN v3_plantels p ON p.id = s.plantelId
         LEFT JOIN v3_users u ON u.id = s.tutorId
         WHERE s.id = ? LIMIT 1`,
        [id]
      )

      return NextResponse.json({
        id: updated?.id,
        nombre: updated?.nombre,
        grado: updated?.grado,
        turno: updated?.turno,
        plantelId: updated?.plantelId,
        tutorId: updated?.tutorId,
        periodoEscolar: updated?.periodoEscolar,
        activa: updated?.activa === 1,
        plantel: updated?.plantelNombre
          ? { id: updated.plantelId, nombre: updated.plantelNombre }
          : null,
        tutor: updated?.tutorId
          ? {
              id: updated.tutorId,
              nombre: updated.tutorNombre,
              apellido: updated.tutorApellido,
              cedula: updated.tutorCedula,
            }
          : null,
      })
    }

    // Desarrollo: Prisma
    const existing = await db.section.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
    }

    if (plantelId && plantelId !== existing.plantelId) {
      const plantel = await db.plantel.findUnique({ where: { id: plantelId } })
      if (!plantel) {
        return NextResponse.json({ error: 'Plantel no encontrado' }, { status: 404 })
      }
    }

    if (tutorId) {
      const tutor = await db.user.findUnique({ where: { id: tutorId } })
      if (!tutor || tutor.rol !== 'profesor') {
        return NextResponse.json({ error: 'Tutor inválido o no es profesor' }, { status: 400 })
      }
    }

    const updated = await db.section.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(grado !== undefined && { grado }),
        ...(turno !== undefined && { turno }),
        ...(plantelId !== undefined && { plantelId }),
        ...(tutorId !== undefined && { tutorId: tutorId || null }),
        ...(activa !== undefined && { activa }),
      },
      include: {
        plantel: { select: { id: true, nombre: true } },
        tutor: { select: { id: true, nombre: true, apellido: true, cedula: true } },
      },
    })

    // Sincronizar SectionAssignment con el tutor
    if (tutorId !== undefined) {
      if (tutorId) {
        await db.sectionAssignment.upsert({
          where: { sectionId_userId: { sectionId: id, userId: tutorId } },
          update: { role: 'tutor' },
          create: { sectionId: id, userId: tutorId, role: 'tutor' },
        })
      }
      // Eliminar asignaciones previas de tutor distinto al nuevo
      await db.sectionAssignment.deleteMany({
        where: { sectionId: id, role: 'tutor', ...(tutorId ? { NOT: { userId: tutorId } } : {}) },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update section error:', error)
    return NextResponse.json({ error: 'Error al actualizar sección' }, { status: 500 })
  }
}

// DELETE /api/admin/sections/[id] — soft delete (activa = false)
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
        'SELECT id FROM v3_sections WHERE id = ? LIMIT 1',
        [id]
      )
      if (!existing) {
        return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
      }
      await d1Run('UPDATE v3_sections SET activa = 0, updatedAt = ? WHERE id = ?', [
        new Date().toISOString(),
        id,
      ])
      return NextResponse.json({ success: true })
    }

    // Desarrollo: Prisma
    const existing = await db.section.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Sección no encontrada' }, { status: 404 })
    }

    await db.section.update({
      where: { id },
      data: { activa: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete section error:', error)
    return NextResponse.json({ error: 'Error al eliminar sección' }, { status: 500 })
  }
}
