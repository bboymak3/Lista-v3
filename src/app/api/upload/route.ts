// Upload API — almacena fotos en filesystem local (en producción: Cloudflare R2)
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import sharp from 'sharp'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Solo se permiten imágenes' }, { status: 400 })
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo excede 5MB' }, { status: 400 })
    }

    // Asegurar directorio
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    // Generar key único
    const ext = file.name.split('.').pop() || 'jpg'
    const key = `${uuidv4()}.${ext}`
    const filePath = path.join(UPLOAD_DIR, key)

    // Optimizar imagen con sharp (resize max 1200px, JPEG quality 80)
    const buffer = Buffer.from(await file.arrayBuffer())
    await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(filePath.replace(`.${ext}`, '.jpg'))

    // El key almacenado en DB apunta a la ruta pública
    const mediaKey = `/uploads/${key.replace(`.${ext}`, '.jpg')}`

    return NextResponse.json({
      mediaKey,
      message: 'Imagen subida correctamente',
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 })
  }
}
