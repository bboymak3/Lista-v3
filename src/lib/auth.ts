import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export const JWT_SECRET = process.env.JWT_SECRET || 'lista-dev-secret-change-in-prod'
export const JWT_EXPIRES_IN = '7d'

export interface JwtPayload {
  id: string
  cedula: string
  rol: string
  nombre: string
  apellido: string
  estudianteId?: string | null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

export function requireRole(rol: string, ...allowed: string[]): boolean {
  return allowed.includes(rol)
}

// Helper para obtener el usuario desde el header Authorization
export function getUserFromRequest(request: Request): JwtPayload | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.substring(7)
  return verifyToken(token)
}
