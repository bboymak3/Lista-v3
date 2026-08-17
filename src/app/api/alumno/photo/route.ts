import { NextRequest, NextResponse } from 'next/server'

import { isD1, d1First, d1Run } from '@/lib/d1'
import { db } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { promises as fs } from 'node:fs'
import path from 'node:path'

function getCloudflareContext(): any | null {
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as any)[sym]
    if (ctx?.env) return ctx
  } catch { /* ignore */ }
  return null
}

// Verifica que el estudiante pertenezca al usuario:
// - admin/super_admin: acceso total
// - alumno: estudiante.user.id === payload.id
// - representante: estudiante asignado al representante vía ParentStudent
async function verifyStudentOwnership(
  payload: { id: string; rol: string },
  estudianteId: string
): Promise<boolean> {
  if (payload.rol === 'admin' || payload.rol === 'super_admin') return true
  if (payload.rol === 'alumno') {
    if (isD1()) {
      const row = await d1First<{ id: string }>(
        'SELECT id FROM v3_students WHERE id = ? AND userId = ? LIMIT 1',
        [estudianteId, payload.id]
      )
      return !!row
    }
    const student = await db.student.findFirst({
      where: { id: estudianteId, userId: payload.id },
      select: { id: true },
    })
    return !!student
  }
  if (payload.rol === 'representante') {
    if (isD1()) {
      const row = await d1First<{ id: string }>(
        'SELECT id FROM v3_parent_student WHERE representanteId = ? AND estudianteId = ? LIMIT 1',
        [payload.id, estudianteId]
      )
      return !!row
    }
    const link = await db.parentStudent.findFirst({
      where: { representanteId: payload.id, estudianteId },
      select: { id: true },
    })
    return !!link
  }
  return false
}

// POST /api/alumno/photo — sube una foto y la asocia al Student.fotoKey
// Body: FormData con "file" (imagen) y "estudianteId"
export async function POST(request: NextRequest) {
  const payload = getUserFromRequest(request)
  if (!payload) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  // Alumnos (para su propio carnet), admin/super_admin y representante (de sus hijos) pueden subir foto
  if (
    payload.rol !== 'alumno' &&
    payload.rol !== 'admin' &&
    payload.rol !== 'super_admin' &&
    payload.rol !== 'representante'
  ) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const estudianteId = formData.get('estudianteId')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo no proporcionado' }, { status: 400 })
    }
    if (!estudianteId || typeof estudianteId !== 'string') {
      return NextResponse.json({ error: 'estudianteId es requerido' }, { status: 400 })
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Solo se permiten imágenes' }, { status: 400 })
    }

    const MAX_SIZE = 5 * 1024 * 1024 // 5MB para foto de perfil
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'La imagen excede 5MB' }, { status: 413 })
    }

    // Verificar propiedad
    const ok = await verifyStudentOwnership(payload, estudianteId)
    if (!ok) {
      return NextResponse.json({ error: 'Estudiante no autorizado' }, { status: 403 })
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif']
    if (!allowedExts.includes(ext)) {
      return NextResponse.json(
        { error: 'Formato no permitido (jpg, png, webp, gif)' },
        { status: 400 }
      )
    }

    const finalExt = ext === 'jpeg' ? 'jpg' : ext
    const mediaKey = `profile-${uuidv4()}.${finalExt}`

    if (isD1()) {
      // Producción: R2 — store at root so /api/files/<mediaKey> resolves correctly
      const ctx = getCloudflareContext()
      const bucket = ctx?.env?.BUCKET as R2Bucket | undefined
      if (!bucket || typeof bucket.put !== 'function') {
        return NextResponse.json({ error: 'R2 no disponible' }, { status: 500 })
      }
      const arrayBuffer = await file.arrayBuffer()
      const contentType = file.type || 'image/jpeg'
      await bucket.put(mediaKey, arrayBuffer, {
        httpMetadata: { contentType },
      })
    } else {
      // Desarrollo: filesystem en public/uploads/<mediaKey>
      const filePath = path.join(process.cwd(), 'public', 'uploads', mediaKey)
      const fileDir = path.dirname(filePath)
      await fs.mkdir(fileDir, { recursive: true })
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Intentar optimizar con sharp (solo dev)
      try {
        const requireFn = new Function('m', 'return require(m)')
        const sharp = requireFn('sharp')
        const optimized = await sharp(buffer)
          .resize(512, 512, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 85 })
          .toBuffer()
        const jpgKey = mediaKey.replace(/\.[^.]+$/, '.jpg')
        const jpgPath = path.join(process.cwd(), 'public', 'uploads', jpgKey)
        await fs.writeFile(jpgPath, optimized)
        // Actualizar el estudiante con el key optimizado
        await db.student.update({ where: { id: estudianteId }, data: { fotoKey: jpgKey } })
        return NextResponse.json({ mediaKey: jpgKey })
      } catch {
        // sharp no disponible — usar buffer original
      }

      await fs.writeFile(filePath, buffer)
    }

    // Actualizar fotoKey en el estudiante
    if (isD1()) {
      await d1Run('UPDATE v3_students SET fotoKey = ? WHERE id = ?', [mediaKey, estudianteId])
    } else {
      await db.student.update({ where: { id: estudianteId }, data: { fotoKey: mediaKey } })
    }

    return NextResponse.json({ mediaKey })
  } catch (error) {
    console.error('Alumno photo upload error:', error)
    return NextResponse.json({ error: 'Error al subir la foto' }, { status: 500 })
  }
}
