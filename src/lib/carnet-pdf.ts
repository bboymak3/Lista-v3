/**
 * Carnet PDF builder — shared entre admin y alumno routes.
 * Genera un PDF imprimible (frontal + reverso) con foto, QR y datos del estudiante.
 *
 * Diseño:
 * - Página A6 portrait (4.13" x 5.83"), dividida horizontalmente en 2 mitades.
 * - Mitad superior = frontal del carnet (foto, nombre, cédula, sección, plantel).
 * - Mitad inferior = reverso del carnet (QR + código único + validez + dirección plantel).
 * - Línea de corte/piegue punteada en el medio.
 *
 * Funciona sin sharp: pdf-lib puede embeber PNG/JPEG buffers directamente.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { isD1, d1First } from '@/lib/d1'
import { db } from '@/lib/db'

// --- Tipos de datos del carnet ---
export interface CarnetStudentData {
  id: string
  codigoUnico: string
  cedulaEscolar: string | null
  nombre: string
  apellido: string
  fechaNacimiento: string | null
  genero: string | null
  qrCode: string
  fotoKey: string | null
  section: {
    id: string
    nombre: string
    grado: string
    turno: string
    periodoEscolar: string
  } | null
  plantel: {
    id: string
    nombre: string
    direccion: string | null
    periodoActual: string
    logoKey: string | null
  } | null
}

// --- Colores (tema emerald/teal) ---
const COLOR_EMERALD = rgb(0.039, 0.471, 0.341) // #0a7857
const COLOR_EMERALD_DARK = rgb(0.024, 0.341, 0.251) // #065740
const COLOR_TEAL = rgb(0.106, 0.545, 0.541) // #1b8b8a
const COLOR_LIGHT_EMERALD = rgb(0.882, 0.961, 0.922) // #e1f5eb
const COLOR_DARK = rgb(0.106, 0.122, 0.110) // #1b1f1c
const COLOR_GRAY = rgb(0.412, 0.451, 0.431) // #69736e
const COLOR_WHITE = rgb(1, 1, 1)
const COLOR_LINE = rgb(0.851, 0.890, 0.863) // #d9e3dc

function getCloudflareContext(): any | null {
  try {
    const sym = Symbol.for('__cloudflare-context__')
    const ctx = (globalThis as any)[sym]
    if (ctx?.env) return ctx
  } catch {
    /* ignore */
  }
  return null
}

/**
 * Obtiene los datos completos del estudiante (con section + plantel) por id.
 * Soporta D1 (prod) y Prisma (dev).
 */
export async function fetchStudentDataForCarnet(
  studentId: string
): Promise<CarnetStudentData | null> {
  if (isD1()) {
    const row = await d1First<{
      id: string
      codigoUnico: string
      cedulaEscolar: string | null
      nombre: string
      apellido: string
      fechaNacimiento: string | null
      genero: string | null
      qrCode: string
      fotoKey: string | null
      sectionId: string
      sectionNombre: string
      sectionGrado: string
      sectionTurno: string
      sectionPeriodo: string
      plantelId: string | null
      plantelNombre: string | null
      plantelDireccion: string | null
      plantelPeriodo: string | null
      plantelLogoKey: string | null
    }>(
      `SELECT s.id, s.codigoUnico, s.cedulaEscolar, s.nombre, s.apellido, s.fechaNacimiento, s.genero, s.qrCode, s.fotoKey,
              sec.id AS sectionId, sec.nombre AS sectionNombre, sec.grado AS sectionGrado, sec.turno AS sectionTurno, sec.periodoEscolar AS sectionPeriodo,
              p.id AS plantelId, p.nombre AS plantelNombre, p.direccion AS plantelDireccion, p.periodoActual AS plantelPeriodo, p.logoKey AS plantelLogoKey
       FROM v3_students s
       LEFT JOIN v3_sections sec ON sec.id = s.sectionId
       LEFT JOIN v3_plantels p ON p.id = sec.plantelId
       WHERE s.id = ? LIMIT 1`,
      [studentId]
    )
    if (!row) return null
    return {
      id: row.id,
      codigoUnico: row.codigoUnico,
      cedulaEscolar: row.cedulaEscolar,
      nombre: row.nombre,
      apellido: row.apellido,
      fechaNacimiento: row.fechaNacimiento,
      genero: row.genero,
      qrCode: row.qrCode,
      fotoKey: row.fotoKey,
      section: row.sectionId
        ? {
            id: row.sectionId,
            nombre: row.sectionNombre,
            grado: row.sectionGrado,
            turno: row.sectionTurno,
            periodoEscolar: row.sectionPeriodo,
          }
        : null,
      plantel: row.plantelId
        ? {
            id: row.plantelId,
            nombre: row.plantelNombre || '',
            direccion: row.plantelDireccion,
            periodoActual: row.plantelPeriodo || '2024-2025',
            logoKey: row.plantelLogoKey,
          }
        : null,
    }
  }

  // Dev: Prisma
  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      section: {
        select: {
          id: true,
          nombre: true,
          grado: true,
          turno: true,
          periodoEscolar: true,
          plantel: {
            select: {
              id: true,
              nombre: true,
              direccion: true,
              periodoActual: true,
              logoKey: true,
            },
          },
        },
      },
    },
  })
  if (!student) return null
  return {
    id: student.id,
    codigoUnico: student.codigoUnico,
    cedulaEscolar: student.cedulaEscolar,
    nombre: student.nombre,
    apellido: student.apellido,
    fechaNacimiento: student.fechaNacimiento,
    genero: student.genero,
    qrCode: student.qrCode,
    fotoKey: student.fotoKey,
    section: student.section
      ? {
          id: student.section.id,
          nombre: student.section.nombre,
          grado: student.section.grado,
          turno: student.section.turno,
          periodoEscolar: student.section.periodoEscolar,
        }
      : null,
    plantel: student.section?.plantel
      ? {
          id: student.section.plantel.id,
          nombre: student.section.plantel.nombre,
          direccion: student.section.plantel.direccion,
          periodoActual: student.section.plantel.periodoActual,
          logoKey: student.section.plantel.logoKey,
        }
      : null,
  }
}

/**
 * Obtiene el buffer de una imagen almacenada en R2 (prod) o filesystem (dev).
 * Devuelve un Uint8Array PNG/JPEG o null si no existe/no hay fotoKey.
 */
export async function fetchPhotoBuffer(
  fotoKey: string | null
): Promise<{ bytes: Uint8Array; format: 'png' | 'jpg' } | null> {
  if (!fotoKey) return null
  const ext = fotoKey.split('.').pop()?.toLowerCase() || ''
  if (ext !== 'png' && ext !== 'jpg' && ext !== 'jpeg') return null
  const format: 'png' | 'jpg' = ext === 'png' ? 'png' : 'jpg'

  if (isD1()) {
    const ctx = getCloudflareContext()
    const bucket = ctx?.env?.BUCKET as R2Bucket | undefined
    if (!bucket || typeof bucket.get !== 'function') return null
    try {
      const obj = await bucket.get(fotoKey)
      if (!obj) return null
      const arrayBuffer = await obj.arrayBuffer()
      return { bytes: new Uint8Array(arrayBuffer), format }
    } catch {
      return null
    }
  }

  // Dev: filesystem
  try {
    const filePath = path.join(process.cwd(), 'public', 'uploads', fotoKey)
    const buffer = await fs.readFile(filePath)
    return { bytes: new Uint8Array(buffer), format }
  } catch {
    return null
  }
}

/**
 * Obtiene el buffer del logo del plantel desde R2 (prod) o filesystem (dev).
 * Acepta PNG/JPEG. Devuelve null si no existe/no hay logoKey.
 */
export async function fetchLogoBuffer(
  logoKey: string | null
): Promise<{ bytes: Uint8Array; format: 'png' | 'jpg' } | null> {
  if (!logoKey) return null
  const ext = logoKey.split('.').pop()?.toLowerCase() || ''
  if (ext !== 'png' && ext !== 'jpg' && ext !== 'jpeg') return null
  const format: 'png' | 'jpg' = ext === 'png' ? 'png' : 'jpg'

  if (isD1()) {
    const ctx = getCloudflareContext()
    const bucket = ctx?.env?.BUCKET as R2Bucket | undefined
    if (!bucket || typeof bucket.get !== 'function') return null
    try {
      const obj = await bucket.get(logoKey)
      if (!obj) return null
      const arrayBuffer = await obj.arrayBuffer()
      return { bytes: new Uint8Array(arrayBuffer), format }
    } catch {
      return null
    }
  }

  // Dev: filesystem
  try {
    const filePath = path.join(process.cwd(), 'public', 'uploads', logoKey)
    const buffer = await fs.readFile(filePath)
    return { bytes: new Uint8Array(buffer), format }
  } catch {
    return null
  }
}

const turnoLabel: Record<string, string> = {
  manana: 'Mañana',
  tarde: 'Tarde',
  nocturno: 'Nocturno',
}

const generoLabel: Record<string, string> = {
  M: 'Masculino',
  F: 'Femenino',
  O: 'Otro',
}

function calcularEdad(fechaNac: string | null): string {
  if (!fechaNac) return ''
  try {
    const nac = new Date(fechaNac)
    const now = new Date()
    let edad = now.getFullYear() - nac.getFullYear()
    const m = now.getMonth() - nac.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < nac.getDate())) edad--
    return `${edad} años`
  } catch {
    return ''
  }
}

/**
 * Genera el PDF del carnet (frente + reverso en una misma página, plegable).
 * @returns Uint8Array con los bytes del PDF.
 */
export async function buildCarnetPdf(
  data: CarnetStudentData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`Carnet Estudiantil — ${data.nombre} ${data.apellido}`)
  pdfDoc.setAuthor('Sistema de Asistencia · Lista')
  pdfDoc.setSubject('Carnet Estudiantil imprimible')
  pdfDoc.setProducer('pdf-lib')
  pdfDoc.setCreator('Lista v3')

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // Página A6 portrait: 4.13" x 5.83" ≈ 297 x 420 pt
  const PAGE_W = 297
  const PAGE_H = 420
  const HALF_H = PAGE_H / 2 // 210 pt — línea de pliegue
  const MARGIN = 14

  const page = pdfDoc.addPage([PAGE_W, PAGE_H])

  const plantelNombre = data.plantel?.nombre || 'Plantel'
  const periodo = data.plantel?.periodoActual || data.section?.periodoEscolar || '2024-2025'

  // ====================================================================
  // FRONTAL (mitad superior) — Diseño moderno con header degradado
  // ====================================================================

  // Fondo blanco general
  page.drawRectangle({
    x: 0, y: HALF_H, width: PAGE_W, height: HALF_H,
    color: COLOR_WHITE,
  })

  // Header con forma moderna: rectángulo emerald con banda teal inferior
  const headerHeight = 95
  const headerBottom = PAGE_H - headerHeight

  // Degradado simulado: 3 bandas emerald de diferente intensidad
  page.drawRectangle({
    x: 0, y: headerBottom + 10, width: PAGE_W, height: headerHeight - 10,
    color: COLOR_EMERALD_DARK,
  })
  page.drawRectangle({
    x: 0, y: headerBottom, width: PAGE_W, height: 10,
    color: COLOR_TEAL,
  })

  // Acento dorado/amarillo en la esquina superior derecha (bandera decorativa)
  page.drawRectangle({
    x: PAGE_W - 50, y: PAGE_H - 8, width: 50, height: 8,
    color: rgb(0.95, 0.76, 0.21), // #f3c236
  })

  // === Logo del plantel ===
  const logoBuffer = data.plantel?.logoKey
    ? await fetchLogoBuffer(data.plantel.logoKey)
    : null
  const logoSize = 56
  const logoX = MARGIN
  const logoY = PAGE_H - logoSize - 16

  if (logoBuffer) {
    try {
      const embedded =
        logoBuffer.format === 'png'
          ? await pdfDoc.embedPng(logoBuffer.bytes)
          : await pdfDoc.embedJpg(logoBuffer.bytes)
      // Círculo blanco detrás del logo (fondo para mejor contraste)
      page.drawRectangle({
        x: logoX - 4, y: logoY - 4,
        width: logoSize + 8, height: logoSize + 8,
        color: COLOR_WHITE,
      })
      page.drawImage(embedded, {
        x: logoX, y: logoY, width: logoSize, height: logoSize,
      })
    } catch { /* ignore */ }
  } else {
    // Si no hay logo, dibujar icono de graduación (circulo emerald con "L")
    page.drawRectangle({
      x: logoX, y: logoY, width: logoSize, height: logoSize,
      color: COLOR_WHITE,
    })
    const gradIcon = 'L'
    const gradW = fontBold.widthOfTextAtSize(gradIcon, 32)
    page.drawText(gradIcon, {
      x: logoX + (logoSize - gradW) / 2,
      y: logoY + (logoSize - 32) / 2 + 4,
      size: 32, font: fontBold, color: COLOR_EMERALD,
    })
  }

  // === Texto del header ===
  const headerTextX = logoX + logoSize + 12

  page.drawText('CARNET', {
    x: headerTextX, y: PAGE_H - 22,
    size: 13, font: fontBold, color: COLOR_WHITE,
  })
  page.drawText('ESTUDIANTIL', {
    x: headerTextX, y: PAGE_H - 35,
    size: 9, font: fontRegular, color: rgb(0.85, 0.95, 0.9),
  })

  // Plantel nombre (alineado a la derecha del header)
  const plantelText = plantelNombre.length > 22 ? plantelNombre.slice(0, 21) + '…' : plantelNombre
  const plantelWidth = fontBold.widthOfTextAtSize(plantelText, 9)
  page.drawText(plantelText, {
    x: PAGE_W - plantelWidth - MARGIN, y: PAGE_H - 22,
    size: 9, font: fontBold, color: COLOR_WHITE,
  })
  const periodoWidth = fontRegular.widthOfTextAtSize(periodo, 7)
  page.drawText(periodo, {
    x: PAGE_W - periodoWidth - MARGIN, y: PAGE_H - 33,
    size: 7, font: fontRegular, color: rgb(0.85, 0.95, 0.9),
  })

  // === Cuerpo del frontal ===
  const bodyTop = headerBottom
  const bodyBottom = HALF_H + 6
  const bodyHeight = bodyTop - bodyBottom

  // Fondo claro con sutil textura (solo un rectángulo claro)
  page.drawRectangle({
    x: 0, y: bodyBottom, width: PAGE_W, height: bodyHeight,
    color: COLOR_LIGHT_EMERALD,
  })

  // === Foto del estudiante con marco circular moderno ===
  const photoSize = 76
  const photoX = MARGIN + 4
  const photoY = bodyBottom + (bodyHeight - photoSize) / 2

  // Marco circular (simulado con rectángulo blanco + borde emerald)
  page.drawRectangle({
    x: photoX - 6, y: photoY - 6,
    width: photoSize + 12, height: photoSize + 12,
    color: COLOR_WHITE,
    borderColor: COLOR_EMERALD,
    borderWidth: 2,
  })

  const photo = await fetchPhotoBuffer(data.fotoKey)
  if (photo) {
    try {
      const embedded =
        photo.format === 'png'
          ? await pdfDoc.embedPng(photo.bytes)
          : await pdfDoc.embedJpg(photo.bytes)
      page.drawImage(embedded, {
        x: photoX, y: photoY, width: photoSize, height: photoSize,
      })
    } catch {
      drawInitialsBox(page, photoX, photoY, photoSize, data.nombre, data.apellido, fontBold, COLOR_EMERALD, COLOR_WHITE)
    }
  } else {
    drawInitialsBox(page, photoX, photoY, photoSize, data.nombre, data.apellido, fontBold, COLOR_EMERALD, COLOR_WHITE)
  }

  // === Información del estudiante (a la derecha de la foto) ===
  const textX = photoX + photoSize + 18
  const textW = PAGE_W - textX - MARGIN - 4

  // Nombre completo (grande, ajusta tamaño si es largo)
  const nombreCompleto = `${data.nombre} ${data.apellido}`
  let nombreSize = 15
  while (fontBold.widthOfTextAtSize(nombreCompleto, nombreSize) > textW && nombreSize > 10) {
    nombreSize -= 0.5
  }
  page.drawText(truncateToWidth(nombreCompleto, textW, fontBold, nombreSize), {
    x: textX, y: bodyTop - 16,
    size: nombreSize, font: fontBold, color: COLOR_DARK,
  })

  // Línea decorativa bajo el nombre
  page.drawLine({
    start: { x: textX, y: bodyTop - 22 },
    end: { x: textX + Math.min(textW, 80), y: bodyTop - 22 },
    thickness: 1.5, color: COLOR_EMERALD,
  })

  // Cédula escolar
  let yPos = bodyTop - 36
  if (data.cedulaEscolar) {
    page.drawText('CÉDULA', {
      x: textX, y: yPos,
      size: 6, font: fontBold, color: COLOR_EMERALD,
    })
    page.drawText(data.cedulaEscolar, {
      x: textX, y: yPos - 11,
      size: 9.5, font: fontRegular, color: COLOR_DARK,
    })
    yPos -= 26
  }

  // Sección
  if (data.section) {
    const turno = turnoLabel[data.section.turno] || data.section.turno
    page.drawText('SECCIÓN', {
      x: textX, y: yPos,
      size: 6, font: fontBold, color: COLOR_EMERALD,
    })
    page.drawText(`${data.section.nombre} · ${turno}`, {
      x: textX, y: yPos - 11,
      size: 9.5, font: fontRegular, color: COLOR_DARK,
    })
    yPos -= 26
  }

  // Grado
  if (data.section) {
    page.drawText('GRADO', {
      x: textX, y: yPos,
      size: 6, font: fontBold, color: COLOR_EMERALD,
    })
    page.drawText(`${data.section.grado}°`, {
      x: textX, y: yPos - 11,
      size: 9.5, font: fontRegular, color: COLOR_DARK,
    })
  }

  // ====================================================================
  // LÍNEA DE PLIEGUE
  // ====================================================================
  drawDashedLine(page, 10, PAGE_W - 10, HALF_H, COLOR_LINE, 0.5, 3, 2)
  const foldLabel = '- - - - - cortar / doblar - - - - -'
  const foldW = fontRegular.widthOfTextAtSize(foldLabel, 6)
  page.drawText(foldLabel, {
    x: (PAGE_W - foldW) / 2, y: HALF_H - 6,
    size: 6, font: fontRegular, color: COLOR_GRAY,
  })

  // ====================================================================
  // REVERSO (mitad inferior) — QR moderno con marco decorativo
  // ====================================================================
  const backTop = HALF_H - 4

  // Fondo blanco
  page.drawRectangle({
    x: 0, y: 0, width: PAGE_W, height: backTop,
    color: COLOR_WHITE,
  })

  // Banda decorativa superior del reverso
  page.drawRectangle({
    x: 0, y: backTop - 24, width: PAGE_W, height: 24,
    color: COLOR_EMERALD_DARK,
  })
  // Acento amarillo
  page.drawRectangle({
    x: 0, y: backTop - 28, width: PAGE_W, height: 4,
    color: rgb(0.95, 0.76, 0.21),
  })

  page.drawText('VERIFICACIÓN DIGITAL', {
    x: MARGIN, y: backTop - 16,
    size: 9, font: fontBold, color: COLOR_WHITE,
  })

  // Generar QR con colores modernos
  const qrPng = await QRCode.toBuffer(data.qrCode, {
    type: 'png',
    width: 400,
    margin: 1,
    color: { dark: '#065740', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  })
  const qrImage = await pdfDoc.embedPng(qrPng)

  // QR más grande con marco decorativo moderno
  const qrSize = 110
  const qrX = (PAGE_W - qrSize) / 2
  const qrY = backTop - 24 - qrSize - 12

  // Marco exterior decorativo (doble borde)
  page.drawRectangle({
    x: qrX - 10, y: qrY - 10,
    width: qrSize + 20, height: qrSize + 20,
    color: COLOR_LIGHT_EMERALD,
    borderColor: COLOR_EMERALD,
    borderWidth: 1.5,
  })
  // Marco interior blanco
  page.drawRectangle({
    x: qrX - 4, y: qrY - 4,
    width: qrSize + 8, height: qrSize + 8,
    color: COLOR_WHITE,
  })
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

  // Esquinas decorativas en el marco del QR (estilo moderno)
  const cornerSize = 8
  const corners = [
    { x: qrX - 10, y: qrY + qrSize + 10 - cornerSize }, // sup-izq
    { x: qrX + qrSize + 10 - cornerSize, y: qrY + qrSize + 10 - cornerSize }, // sup-der
    { x: qrX - 10, y: qrY - 10 }, // inf-izq
    { x: qrX + qrSize + 10 - cornerSize, y: qrY - 10 }, // inf-der
  ]
  corners.forEach((c, i) => {
    page.drawRectangle({
      x: c.x, y: c.y, width: cornerSize, height: cornerSize,
      color: COLOR_EMERALD,
    })
  })

  // Texto "Escanea para verificar"
  const scanText = 'Escanea para verificar'
  const scanW = fontBold.widthOfTextAtSize(scanText, 9)
  page.drawText(scanText, {
    x: (PAGE_W - scanW) / 2, y: qrY - 16,
    size: 9, font: fontBold, color: COLOR_EMERALD_DARK,
  })

  // Código único del estudiante en una "caja" destacada
  const codigoBoxY = qrY - 38
  const codigoBoxH = 18
  page.drawRectangle({
    x: MARGIN + 20, y: codigoBoxY,
    width: PAGE_W - 2 * (MARGIN + 20), height: codigoBoxH,
    color: COLOR_LIGHT_EMERALD,
    borderColor: COLOR_EMERALD,
    borderWidth: 0.5,
  })
  const codigoLabel = 'CÓDIGO:'
  const codigoValue = data.codigoUnico
  const labelW = fontBold.widthOfTextAtSize(codigoLabel, 7)
  page.drawText(codigoLabel, {
    x: MARGIN + 28, y: codigoBoxY + 6,
    size: 7, font: fontBold, color: COLOR_EMERALD_DARK,
  })
  page.drawText(codigoValue, {
    x: MARGIN + 28 + labelW + 6, y: codigoBoxY + 6,
    size: 8, font: fontRegular, color: COLOR_DARK,
  })

  // Validez del carnet
  const validText = `Válido · Período ${periodo}`
  const validW = fontOblique.widthOfTextAtSize(validText, 7)
  page.drawText(validText, {
    x: (PAGE_W - validW) / 2, y: codigoBoxY - 14,
    size: 7, font: fontOblique, color: COLOR_GRAY,
  })

  // Footer con dirección del plantel
  const direccion = data.plantel?.direccion?.trim()
  if (direccion) {
    const dirText = truncateToWidth(direccion, PAGE_W - 2 * MARGIN, fontRegular, 7)
    const dirW = fontRegular.widthOfTextAtSize(dirText, 7)
    page.drawText(dirText, {
      x: (PAGE_W - dirW) / 2, y: 14,
      size: 7, font: fontRegular, color: COLOR_GRAY,
    })
  }

  // Esquina inferior: identificación del sistema
  const footerText = 'Lista · Sistema de Asistencia'
  const footerW = fontOblique.widthOfTextAtSize(footerText, 6)
  page.drawText(footerText, {
    x: (PAGE_W - footerW) / 2, y: 6,
    size: 6, font: fontOblique, color: COLOR_GRAY,
  })

  return await pdfDoc.save()
}

// --- Helpers de dibujo ---

function drawInitialsBox(
  page: any,
  x: number,
  y: number,
  size: number,
  nombre: string,
  apellido: string,
  font: any,
  bgColor: any,
  fgColor: any
) {
  page.drawRectangle({ x, y, width: size, height: size, color: bgColor })
  const initials = `${(nombre || '?')[0]?.toUpperCase() || ''}${(apellido || '?')[0]?.toUpperCase() || ''}`
  const fontSize = 28
  const w = font.widthOfTextAtSize(initials, fontSize)
  page.drawText(initials, {
    x: x + (size - w) / 2,
    y: y + (size - fontSize) / 2 + 2,
    size: fontSize,
    font,
    color: fgColor,
  })
}

function drawDashedLine(
  page: any,
  x1: number,
  x2: number,
  y: number,
  color: any,
  thickness: number,
  dashOn: number,
  dashOff: number
) {
  let x = x1
  while (x < x2) {
    const end = Math.min(x + dashOn, x2)
    page.drawLine({
      start: { x, y },
      end: { x: end, y },
      thickness,
      color,
    })
    x = end + dashOff
  }
}

function truncateToWidth(text: string, maxWidth: number, font: any, size: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const candidate = text.slice(0, mid) + '…'
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo) + '…'
}
