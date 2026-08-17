import { NextRequest, NextResponse } from 'next/server'
import { isD1, d1Query, d1Run, d1First } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

// GET /api/super-admin/plantels — lista todos los liceos con stats
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (isD1()) {
    const plantels = await d1Query<{
      id: string; nombre: string; descripcion: string | null; direccion: string | null;
      telefono: string | null; email: string | null; lat: number; lng: number;
      radioM: number; logoKey: string | null; periodoActual: string; activo: number;
      createdAt: string
    }>(`SELECT * FROM v3_plantels ORDER BY nombre ASC`, [])

    // Stats por plantel
    const result = await Promise.all(plantels.map(async (p) => {
      const sections = await d1First<{ c: number }>(
        'SELECT COUNT(*) as c FROM v3_sections WHERE plantelId = ? AND activa = 1', [p.id]
      )
      const students = await d1First<{ c: number }>(
        `SELECT COUNT(*) as c FROM v3_students st JOIN v3_sections s ON s.id = st.sectionId WHERE s.plantelId = ? AND st.activo = 1`,
        [p.id]
      )
      const users = await d1First<{ c: number }>(
        'SELECT COUNT(*) as c FROM v3_users WHERE plantelId = ? AND activo = 1', [p.id]
      )
      return {
        ...p,
        activo: p.activo === 1,
        sectionsCount: sections?.c || 0,
        studentsCount: students?.c || 0,
        usersCount: users?.c || 0,
      }
    }))

    return NextResponse.json({ plantels: result })
  }

  // Dev
  const { db } = await import('@/lib/db-dev')
  const plantels = await db.plantel.findMany({
    include: { _count: { select: { sections: true, users: true } } },
    orderBy: { nombre: 'asc' }
  })
  return NextResponse.json({
    plantels: plantels.map(p => ({
      ...p,
      activo: Boolean(p.activo),
      sectionsCount: p._count.sections,
      usersCount: p._count.users,
      studentsCount: 0
    }))
  })
}

// POST /api/super-admin/plantels — crear liceo
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user || user.rol !== 'super_admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { nombre, descripcion, direccion, telefono, email, lat, lng, radioM, logoKey } = body

  if (!nombre || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'nombre, lat y lng son requeridos' }, { status: 400 })
  }

  const id = uuidv4()
  if (isD1()) {
    await d1Run(
      `INSERT INTO v3_plantels (id, nombre, descripcion, direccion, telefono, email, lat, lng, radioM, logoKey, periodoActual, activo, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2024-2025', 1, datetime('now'), datetime('now'))`,
      [id, nombre, descripcion || null, direccion || null, telefono || null, email || null, lat, lng, radioM || 150, logoKey || null]
    )
    const plantel = await d1First(`SELECT * FROM v3_plantels WHERE id = ?`, [id])
    return NextResponse.json({ plantel: { ...plantel, activo: true } }, { status: 201 })
  }

  const { db } = await import('@/lib/db-dev')
  const plantel = await db.plantel.create({
    data: { id, nombre, descripcion, direccion, telefono, email, lat, lng, radioM: radioM || 150, logoKey }
  })
  return NextResponse.json({ plantel }, { status: 201 })
}
