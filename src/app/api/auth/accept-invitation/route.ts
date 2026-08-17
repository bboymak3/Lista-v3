import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { hashPassword, signToken, JwtPayload } from '@/lib/auth'

interface InvitationRow {
  id: string
  token: string
  userId: string
  used: number
  expiresAt: string
  createdAt: string
}

interface RepresentanteRow {
  id: string
  cedula: string
  nombre: string
  apellido: string
  email: string | null
  rol: string
  activo: number | boolean
}

/**
 * Busca una invitación válida (existe, no usada, no expirada).
 * Soporta tanto D1 (used=0/1 INTEGER) como Prisma (boolean).
 */
async function findValidInvitation(
  token: string
): Promise<{ invitation: InvitationRow; representante: RepresentanteRow } | null> {
  if (isD1()) {
    const invitation = await d1First<InvitationRow>(
      'SELECT id, token, userId, used, expiresAt, createdAt FROM v3_invitation_tokens WHERE token = ? LIMIT 1',
      [token]
    )
    if (!invitation) return null

    if (invitation.used === 1) return null
    const expiresAt = new Date(invitation.expiresAt)
    if (expiresAt.getTime() < Date.now()) return null

    const representante = await d1First<RepresentanteRow>(
      'SELECT id, cedula, nombre, apellido, email, rol, activo FROM v3_users WHERE id = ? LIMIT 1',
      [invitation.userId]
    )
    if (!representante) return null
    if (representante.activo !== 1) return null

    return { invitation, representante }
  }

  // Dev: Prisma
  const invitation = await db.invitationToken.findUnique({
    where: { token },
    include: { user: true },
  })
  if (!invitation) return null
  if (invitation.used) return null
  if (invitation.expiresAt < new Date()) return null
  if (!invitation.user.activo) return null

  // Mapear a forma común
  const u = invitation.user
  return {
    invitation: {
      id: invitation.id,
      token: invitation.token,
      userId: invitation.userId,
      used: invitation.used ? 1 : 0,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    },
    representante: {
      id: u.id,
      cedula: u.cedula,
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
    },
  }
}

/**
 * GET /api/auth/accept-invitation?token=xxx
 * Valida el token y devuelve los datos del representante para mostrar
 * en la pantalla pública de aceptación de invitación.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token') || ''

  if (!token) {
    return NextResponse.json(
      { valid: false, error: 'Token requerido' },
      { status: 400 }
    )
  }

  try {
    const found = await findValidInvitation(token)
    if (!found) {
      return NextResponse.json(
        {
          valid: false,
          error: 'El enlace ha expirado o ya fue usado',
        },
        { status: 410 }
      )
    }

    return NextResponse.json({
      valid: true,
      representante: {
        id: found.representante.id,
        cedula: found.representante.cedula,
        nombre: found.representante.nombre,
        apellido: found.representante.apellido,
        email: found.representante.email,
      },
      expiresAt: found.invitation.expiresAt,
    })
  } catch (error) {
    console.error('Accept invitation GET error:', error)
    return NextResponse.json(
      { valid: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/accept-invitation?token=xxx
 * Body: { password }
 * Establece la contraseña del representante, marca el token como usado,
 * e inicia sesión automáticamente devolviendo un JWT.
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token') || ''

  if (!token) {
    return NextResponse.json(
      { error: 'Token requerido' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const password: string = typeof body?.password === 'string' ? body.password : ''

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    const found = await findValidInvitation(token)
    if (!found) {
      return NextResponse.json(
        { error: 'El enlace ha expirado o ya fue usado' },
        { status: 410 }
      )
    }

    const { invitation, representante } = found
    const hashedPassword = await hashPassword(password)
    const now = new Date().toISOString()

    // Actualizar password del usuario
    if (isD1()) {
      await d1Run(
        'UPDATE v3_users SET password = ?, updatedAt = ? WHERE id = ?',
        [hashedPassword, now, representante.id]
      )
      // Marcar token como usado
      await d1Run(
        'UPDATE v3_invitation_tokens SET used = 1 WHERE id = ?',
        [invitation.id]
      )
    } else {
      await db.user.update({
        where: { id: representante.id },
        data: { password: hashedPassword },
      })
      await db.invitationToken.update({
        where: { id: invitation.id },
        data: { used: true },
      })
    }

    // Generar JWT (auto-login) — mismo formato que /api/auth/login
    const payload: JwtPayload = {
      id: representante.id,
      cedula: representante.cedula,
      rol: representante.rol,
      nombre: representante.nombre,
      apellido: representante.apellido,
      estudianteId: null,
    }
    const jwt = signToken(payload)

    return NextResponse.json({
      token: jwt,
      user: {
        id: representante.id,
        cedula: representante.cedula,
        rol: representante.rol,
        nombre: representante.nombre,
        apellido: representante.apellido,
        estudianteId: null,
      },
    })
  } catch (error) {
    console.error('Accept invitation POST error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
