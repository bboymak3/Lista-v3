import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

const INVITATION_TTL_DAYS = 7

/**
 * Genera un token de invitación aleatorio seguro (32+ hex chars).
 */
function generateToken(): string {
  // uuid v4 sin guiones + extra entropy
  return uuidv4().replace(/-/g, '') + uuidv4().slice(0, 8)
}

/**
 * Construye la URL pública de invitación a partir del request.
 * Aceptamos override vía env LISTA_PUBLIC_URL para producción (workers.dev / custom domain).
 */
function buildInvitationUrl(req: NextRequest, token: string): string {
  const envUrl = process.env.LISTA_PUBLIC_URL
  if (envUrl) {
    return `${envUrl.replace(/\/$/, '')}/?invitacion=${token}`
  }
  // fallback: usar el host del request
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  const host = req.headers.get('host') || 'lista.activo.workers.dev'
  return `${proto}://${host}/?invitacion=${token}`
}

/**
 * POST /api/admin/representantes/[id]/invite
 * Genera (o reemplaza) un token de invitación para que el representante
 * establezca su propia contraseña. Devuelve token, url y url de WhatsApp.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = getUserFromRequest(request)
  if (!adminUser || adminUser.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const { id: userId } = await params

    // Buscar al representante
    let representante: {
      id: string
      nombre: string
      apellido: string
      whatsapp: string | null
      rol: string
    } | null = null

    if (isD1()) {
      representante = await d1First<{
        id: string
        nombre: string
        apellido: string
        whatsapp: string | null
        rol: string
      }>(
        'SELECT id, nombre, apellido, whatsapp, rol FROM v3_users WHERE id = ? LIMIT 1',
        [userId]
      )
    } else {
      representante = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, nombre: true, apellido: true, whatsapp: true, rol: true },
      })
    }

    if (!representante) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (representante.rol !== 'representante') {
      return NextResponse.json(
        { error: 'Las invitaciones solo aplican a representantes' },
        { status: 400 }
      )
    }

    // Invalidar tokens previos no usados (los marcamos como usados para
    // que no queden activos múltiples a la vez).
    if (isD1()) {
      await d1Run(
        'UPDATE v3_invitation_tokens SET used = 1 WHERE userId = ? AND used = 0',
        [userId]
      )
    } else {
      await db.invitationToken.updateMany({
        where: { userId, used: false },
        data: { used: true },
      })
    }

    const token = generateToken()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000)

    if (isD1()) {
      const newId = uuidv4()
      await d1Run(
        `INSERT INTO v3_invitation_tokens (id, token, userId, used, expiresAt, createdAt)
         VALUES (?, ?, ?, 0, ?, ?)`,
        [newId, token, userId, expiresAt.toISOString(), now.toISOString()]
      )
    } else {
      await db.invitationToken.create({
        data: {
          token,
          userId,
          used: false,
          expiresAt,
        },
      })
    }

    const url = buildInvitationUrl(request, token)
    const nombreCompleto = `${representante.nombre} ${representante.apellido}`.trim()
    const whatsappDigits = (representante.whatsapp || '').replace(/\D/g, '')
    const message = `Hola ${nombreCompleto}, te han registrado en el Sistema de Asistencia Escolar Lista. Completa tu registro aquí: ${url}`
    const whatsappUrl = whatsappDigits
      ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(message)}`
      : null

    return NextResponse.json({
      token,
      url,
      whatsappUrl,
      whatsappNumber: whatsappDigits || null,
      message,
      expiresAt: expiresAt.toISOString(),
      expiresAtDays: INVITATION_TTL_DAYS,
      representante: {
        id: representante.id,
        nombre: representante.nombre,
        apellido: representante.apellido,
        whatsapp: representante.whatsapp,
      },
    })
  } catch (error) {
    console.error('Generate invitation error:', error)
    return NextResponse.json({ error: 'Error al generar invitación' }, { status: 500 })
  }
}

/**
 * GET /api/admin/representantes/[id]/invite
 * Devuelve el estado de la invitación actual del representante.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = getUserFromRequest(request)
  if (!adminUser || adminUser.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const { id: userId } = await params

    if (isD1()) {
      const row = await d1First<{
        id: string
        token: string
        used: number
        expiresAt: string
        createdAt: string
      }>(
        `SELECT id, token, used, expiresAt, createdAt
         FROM v3_invitation_tokens
         WHERE userId = ?
         ORDER BY createdAt DESC
         LIMIT 1`,
        [userId]
      )

      if (!row) {
        return NextResponse.json({ hasInvitation: false })
      }

      const now = new Date()
      const expiresAt = new Date(row.expiresAt)
      const used = row.used === 1
      const expired = !used && expiresAt.getTime() < now.getTime()

      return NextResponse.json({
        hasInvitation: true,
        token: row.token,
        used,
        expired,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        url: buildInvitationUrl(request, row.token),
      })
    }

    // Dev: Prisma
    const invitation = await db.invitationToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (!invitation) {
      return NextResponse.json({ hasInvitation: false })
    }

    const now = new Date()
    const expired = !invitation.used && invitation.expiresAt < now

    return NextResponse.json({
      hasInvitation: true,
      token: invitation.token,
      used: invitation.used,
      expired,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      url: buildInvitationUrl(request, invitation.token),
    })
  } catch (error) {
    console.error('Get invitation status error:', error)
    return NextResponse.json({ error: 'Error al consultar invitación' }, { status: 500 })
  }
}
