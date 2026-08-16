import { NextRequest, NextResponse } from 'next/server'

import { isD1 } from '@/lib/d1'
import { getUserFromRequest } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// getCloudflareContext se obtiene indirectamente a través de isD1 y de la API de Cloudflare.
// Para acceder a BUCKET (R2), replicamos el helper del d1.ts aquí mismo.
function getCloudflareContext(): any | null {
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as any)[sym]
    if (ctx?.env) return ctx
  } catch { /* ignore */ }
  return null
}

// POST /api/upload — recibe FormData con un archivo "file" y devuelve mediaKey.
// En desarrollo: guarda en public/uploads/ (con sharp si está disponible).
// En producción: sube el buffer original a R2 con key `uploads/<uuid>.<ext>`.
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo no proporcionado' }, { status: 400 })
    }

    // Limitar tamaño a 10MB
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'El archivo excede el tamaño máximo (10MB)' },
        { status: 413 }
      )
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif']
    if (!allowedExts.includes(ext)) {
      return NextResponse.json(
        { error: 'Formato no permitido (solo jpg, png, webp, gif)' },
        { status: 400 }
      )
    }

    const mediaKey = `uploads/${uuidv4()}.${ext === 'jpeg' ? 'jpg' : ext}`

    if (isD1()) {
      // Producción: R2 bucket binding (BUCKET)
      const ctx = getCloudflareContext()
      const bucket = ctx?.env?.BUCKET as R2Bucket | undefined
      if (!bucket || typeof bucket.put !== 'function') {
        return NextResponse.json(
          { error: 'R2 bucket no disponible' },
          { status: 500 }
        )
      }
      // Subir el buffer original (sin sharp — workers no soportan sharp)
      const arrayBuffer = await file.arrayBuffer()
      await bucket.put(mediaKey, arrayBuffer, {
        httpMetadata: { contentType: file.type || 'image/jpeg' },
      })
      return NextResponse.json({ mediaKey })
    }

    // Desarrollo: filesystem local — usar sharp si está disponible, sino buffer original
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadsDir, { recursive: true })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Intentar optimizar con sharp (solo en dev — sharp es node-only)
    let finalBuffer = buffer
    try {
      // Usar new Function para evitar que el bundler resuelva 'sharp'
      const requireFn = new Function('m', 'return require(m)')
      const sharp = requireFn('sharp')
      finalBuffer = await sharp(buffer)
        .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer()
      // Si sharp lo convirtió a jpg, ajustar la extensión del mediaKey
      if (!mediaKey.endsWith('.jpg')) {
        const jpgKey = mediaKey.replace(/\.[^.]+$/, '.jpg')
        const outPath = path.join(uploadsDir, jpgKey)
        await fs.writeFile(outPath, finalBuffer)
        return NextResponse.json({ mediaKey: jpgKey })
      }
    } catch {
      // sharp no disponible o falla — usar buffer original
      finalBuffer = buffer
    }

    const outPath = path.join(uploadsDir, mediaKey)
    await fs.writeFile(outPath, finalBuffer)

    return NextResponse.json({ mediaKey })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}
