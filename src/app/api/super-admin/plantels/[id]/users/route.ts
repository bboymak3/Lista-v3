import { NextRequest, NextResponse } from 'next/server'
import { isD1, d1Query } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'

// GET /api/super-admin/plantels/[id]/users?role=profesor|admin|representante
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')

  if (isD1()) {
    let sql = `SELECT id, cedula, nombre, apellido, email, rol, telefono, whatsapp, fotoKey, activo
               FROM v3_users WHERE plantelId = ? AND activo = 1`
    const args: any[] = [id]
    if (role) {
      sql += ` AND rol = ?`
      args.push(role)
    }
    sql += ` ORDER BY nombre ASC`
    const users = await d1Query(sql, args)
    return NextResponse.json({ users })
  }

  const { db } = await import('@/lib/db-dev')
  const users = await db.user.findMany({
    where: { plantelId: id, activo: true, ...(role ? { rol: role } : {}) },
    orderBy: { nombre: 'asc' }
  })
  return NextResponse.json({ users })
}
