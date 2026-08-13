import { NextRequest, NextResponse } from 'next/server'
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
    const existing = await db.user.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // No desactivarse a sí mismo
    if (id === user.id) {
      return NextResponse.json(
        { error: 'No puedes desactivar tu propia cuenta' },
        { status: 400 }
      )
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
