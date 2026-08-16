import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { hashPassword } from '@/lib/db-auth'

// PUT /api/admin/users/[id] — update user (optional password re-hash)
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
    const { cedula, nombre, apellido, email, password, rol, telefono, activo } = body

    if (isD1()) {
      // Producción: D1
      const existing = await d1First<{ id: string; cedula: string; email: string | null }>(
        'SELECT id, cedula, email FROM v3_users WHERE id = ? LIMIT 1',
        [id]
      )
      if (!existing) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
      }

      // Verificar unicidad de cédula si cambia
      if (cedula && cedula !== existing.cedula) {
        const dup = await d1First<{ id: string }>(
          'SELECT id FROM v3_users WHERE cedula = ? AND id != ? LIMIT 1',
          [cedula, id]
        )
        if (dup) {
          return NextResponse.json({ error: 'La cédula ya está registrada' }, { status: 409 })
        }
      }

      // Verificar unicidad de email si cambia
      if (email && email !== existing.email) {
        const dup = await d1First<{ id: string }>(
          'SELECT id FROM v3_users WHERE email = ? AND id != ? LIMIT 1',
          [email, id]
        )
        if (dup) {
          return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })
        }
      }

      if (rol) {
        const validRoles = ['admin', 'profesor', 'representante', 'alumno']
        if (!validRoles.includes(rol)) {
          return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
        }
      }

      const sets: string[] = []
      const sqlParams: unknown[] = []
      if (cedula !== undefined) { sets.push('cedula = ?'); sqlParams.push(cedula) }
      if (nombre !== undefined) { sets.push('nombre = ?'); sqlParams.push(nombre) }
      if (apellido !== undefined) { sets.push('apellido = ?'); sqlParams.push(apellido) }
      if (email !== undefined) { sets.push('email = ?'); sqlParams.push(email || null) }
      if (rol !== undefined) { sets.push('rol = ?'); sqlParams.push(rol) }
      if (telefono !== undefined) { sets.push('telefono = ?'); sqlParams.push(telefono || null) }
      if (activo !== undefined) { sets.push('activo = ?'); sqlParams.push(activo ? 1 : 0) }

      // Re-hashear password si viene
      if (password) {
        const hashedPassword = await hashPassword(password)
        sets.push('password = ?')
        sqlParams.push(hashedPassword)
      }

      sets.push('updatedAt = ?')
      sqlParams.push(new Date().toISOString())
      sqlParams.push(id)

      if (sets.length > 1) {
        await d1Run(`UPDATE v3_users SET ${sets.join(', ')} WHERE id = ?`, sqlParams)
      }

      const updated = await d1First<{
        id: string
        cedula: string
        nombre: string
        apellido: string
        email: string | null
        rol: string
        telefono: string | null
        activo: number
        createdAt: string
      }>(
        'SELECT id, cedula, nombre, apellido, email, rol, telefono, activo, createdAt FROM v3_users WHERE id = ? LIMIT 1',
        [id]
      )

      return NextResponse.json({
        id: updated?.id,
        cedula: updated?.cedula,
        nombre: updated?.nombre,
        apellido: updated?.apellido,
        email: updated?.email,
        rol: updated?.rol,
        telefono: updated?.telefono,
        activo: updated?.activo === 1,
        createdAt: updated?.createdAt,
      })
    }

    // Desarrollo: Prisma
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Verificar unicidad de cédula si cambia
    if (cedula && cedula !== existing.cedula) {
      const dup = await db.user.findUnique({ where: { cedula } })
      if (dup) {
        return NextResponse.json({ error: 'La cédula ya está registrada' }, { status: 409 })
      }
    }

    // Verificar unicidad de email si cambia
    if (email && email !== existing.email) {
      const dup = await db.user.findUnique({ where: { email } })
      if (dup) {
        return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 })
      }
    }

    if (rol) {
      const validRoles = ['admin', 'profesor', 'representante', 'alumno']
      if (!validRoles.includes(rol)) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
      }
    }

    const data: any = {
      ...(cedula !== undefined && { cedula }),
      ...(nombre !== undefined && { nombre }),
      ...(apellido !== undefined && { apellido }),
      ...(email !== undefined && { email: email || null }),
      ...(rol !== undefined && { rol }),
      ...(telefono !== undefined && { telefono: telefono || null }),
      ...(activo !== undefined && { activo }),
    }

    // Re-hashear password si viene
    if (password) {
      data.password = await hashPassword(password)
    }

    const updated = await db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        cedula: true,
        nombre: true,
        apellido: true,
        email: true,
        rol: true,
        telefono: true,
        activo: true,
        createdAt: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 })
  }
}

// DELETE /api/admin/users/[id] — soft delete (activo = false)
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

    // No desactivarse a sí mismo
    if (id === user.id) {
      return NextResponse.json(
        { error: 'No puedes desactivar tu propia cuenta' },
        { status: 400 }
      )
    }

    if (isD1()) {
      // Producción: D1
      const existing = await d1First<{ id: string }>(
        'SELECT id FROM v3_users WHERE id = ? LIMIT 1',
        [id]
      )
      if (!existing) {
        return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
      }
      await d1Run('UPDATE v3_users SET activo = 0, updatedAt = ? WHERE id = ?', [
        new Date().toISOString(),
        id,
      ])
      return NextResponse.json({ success: true })
    }

    // Desarrollo: Prisma
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    await db.user.update({
      where: { id },
      data: { activo: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 })
  }
}
