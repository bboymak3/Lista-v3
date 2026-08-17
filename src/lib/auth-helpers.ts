import { NextRequest } from 'next/server'
import { getUserFromRequest } from './auth'
import { isD1, d1First } from './d1'

// Obtiene el plantelId del usuario autenticado
// super_admin → null (ve todos)
// admin/profesor/representante/alumno → su plantelId
export async function getUserPlantelId(request: NextRequest): Promise<string | null> {
  const user = getUserFromRequest(request)
  if (!user) return null
  if (user.rol === 'super_admin') return null

  if (isD1()) {
    const userRow = await d1First<{ plantelId: string | null }>(
      'SELECT plantelId FROM v3_users WHERE id = ?',
      [user.id]
    )
    return userRow?.plantelId ?? null
  }

  // Dev (Prisma)
  const { db } = await import('./db-dev')
  const u = await db.user.findUnique({ where: { id: user.id }, select: { plantelId: true } })
  return u?.plantelId ?? null
}

export function canAccessPlantel(
  userRol: string,
  userPlantelId: string | null,
  targetPlantelId: string
): boolean {
  if (userRol === 'super_admin') return true
  return userPlantelId === targetPlantelId
}
