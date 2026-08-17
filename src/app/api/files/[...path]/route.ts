import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// GET /api/files/[...path] — sirve archivos de R2 (prod) o filesystem (dev)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathParts } = await params
  const key = pathParts.join('/')
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')

  // Determinar content-type por extensión
  const ext = key.split('.').pop()?.toLowerCase() || ''
  const contentTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
  }
  const contentType = contentTypes[ext] || 'application/octet-stream'

  // Producción: R2 bucket binding
  if (process.env.NODE_ENV === 'production') {
    try {
      const sym = Symbol.for('__cloudflare-context__')
      const ctx = (globalThis as any)[sym]
      const bucket = ctx?.env?.BUCKET as R2Bucket | undefined
      if (!bucket || typeof bucket.get !== 'function') {
        return NextResponse.json({ error: 'R2 no disponible' }, { status: 500 })
      }
      const object = await bucket.get(key)
      if (!object) {
        return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
      }
      const headers = new Headers()
      headers.set('Content-Type', contentType)
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      return new NextResponse(object.body as any, { headers })
    } catch (error) {
      console.error('File serve error:', error)
      return NextResponse.json({ error: 'Error al obtener archivo' }, { status: 500 })
    }
  }

  // Desarrollo: filesystem
  try {
    const filePath = path.join(uploadsDir, key)
    const buffer = await fs.readFile(filePath)
    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    return new NextResponse(buffer, { headers })
  } catch {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }
}
