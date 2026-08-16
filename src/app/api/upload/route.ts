import { NextRequest, NextResponse } from 'next/server'
import { isD1 } from '@/lib/d1'
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

// POST /api/upload — recibe FormData con archivo "file" y devuelve mediaKey
// Acepta imágenes (jpg, png, webp, gif) y PDFs
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

    const MAX_SIZE = 15 * 1024 * 1024 // 15MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'El archivo excede 15MB' }, { status: 413 })
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']
    if (!allowedExts.includes(ext)) {
      return NextResponse.json({ error: 'Formato no permitido (jpg, png, webp, gif, pdf)' }, { status: 400 })
    }

    const finalExt = ext === 'jpeg' ? 'jpg' : ext
    const mediaKey = `uploads/${uuidv4()}.${finalExt}`

    if (isD1()) {
      // Producción: R2
      const ctx = getCloudflareContext()
      const bucket = ctx?.env?.BUCKET as R2Bucket | undefined
      if (!bucket || typeof bucket.put !== 'function') {
        return NextResponse.json({ error: 'R2 no disponible' }, { status: 500 })
      }
      const arrayBuffer = await file.arrayBuffer()
      const contentType = file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg')
      await bucket.put(mediaKey, arrayBuffer, {
        httpMetadata: { contentType },
      })
      return NextResponse.json({ mediaKey })
    }

    // Desarrollo: filesystem
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(uploadsDir, { recursive: true })
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Para imágenes, intentar optimizar con sharp (solo dev)
    if (ext !== 'pdf') {
      try {
        const requireFn = new Function('m', 'return require(m)')
        const sharp = requireFn('sharp')
        const optimized = await sharp(buffer)
          .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer()
        const jpgKey = mediaKey.replace(/\.[^.]+$/, '.jpg')
        await fs.writeFile(path.join(uploadsDir, jpgKey), optimized)
        return NextResponse.json({ mediaKey: jpgKey })
      } catch {
        // sharp no disponible — usar buffer original
      }
    }

    await fs.writeFile(path.join(uploadsDir, mediaKey), buffer)
    return NextResponse.json({ mediaKey })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}
