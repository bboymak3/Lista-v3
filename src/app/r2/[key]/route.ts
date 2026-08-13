import { NextRequest, NextResponse } from 'next/server'


// GET /r2/[key] — sirve imágenes del bucket R2 en producción
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params

  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json({ error: 'R2 solo disponible en producción' }, { status: 404 })
  }

  try {
    const { getRequestContext } = require('@cloudflare/next-on-pages')
    const env = getRequestContext().env as { BUCKET?: any }
    const bucket = env?.BUCKET
    if (!bucket) {
      return NextResponse.json({ error: 'Bucket no configurado' }, { status: 500 })
    }
    const object = await bucket.get(key)
    if (!object) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    }
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    return new NextResponse(object.body as any, { headers })
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener imagen' }, { status: 500 })
  }
}
