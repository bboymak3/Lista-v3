import { NextRequest, NextResponse } from 'next/server'
import { isD1, d1Run } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// POST /api/profile/photo — subir/cambiar foto de perfil propia
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (user.rol === 'alumno') {
    return NextResponse.json({ error: 'No puedes cambiar tu foto. Pide a la dirección.' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Archivo no proporcionado' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Solo imágenes' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Max 5MB' }, { status: 413 })

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const mediaKey = `profile-${uuidv4()}.${ext === 'jpeg' ? 'jpg' : ext}`
  const arrayBuffer = await file.arrayBuffer()

  if (isD1()) {
    // R2
    try {
      const sym = Symbol.for('__cloudflare-context__')
      const ctx = (globalThis as any)[sym]
      const bucket = ctx?.env?.BUCKET
      if (bucket?.put) {
        await bucket.put(mediaKey, arrayBuffer, { httpMetadata: { contentType: file.type } })
      }
    } catch { /* ignore R2 errors */ }
  } else {
    // Filesystem
    const dir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, mediaKey), Buffer.from(arrayBuffer))
  }

  // Guardar mediaKey en v3_users.fotoKey
  if (isD1()) {
    await d1Run('UPDATE v3_users SET fotoKey = ? WHERE id = ?', [mediaKey, user.id])
  } else {
    const { db } = await import('@/lib/db-dev')
    await db.user.update({ where: { id: user.id }, data: { fotoKey: mediaKey } })
  }

  return NextResponse.json({ fotoKey: mediaKey })
}
