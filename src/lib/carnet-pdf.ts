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
    }>(
      `SELECT s.id, s.codigoUnico, s.cedulaEscolar, s.nombre, s.apellido, s.fechaNacimiento, s.genero, s.qrCode, s.fotoKey,
              sec.id AS sectionId, sec.nombre AS sectionNombre, sec.grado AS sectionGrado, sec.turno AS sectionTurno, sec.periodoEscolar AS sectionPeriodo,
              p.id AS plantelId, p.nombre AS plantelNombre, p.direccion AS plantelDireccion, p.periodoActual AS plantelPeriodo
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

  // Página A6 portrait (en puntos PDF: 1 inch = 72 pt)
  // 4.13" x 5.83" ≈ 297 x 420 pt
  const PAGE_W = 297
  const PAGE_H = 420
  const HALF_H = PAGE_H / 2 // 210 pt — línea de pliegue

  const page = pdfDoc.addPage([PAGE_W, PAGE_H])

  // ====== FRONTAL (mitad superior) ======
  // Header con gradiente emulado (rectángulo emerald sólido)
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 110,
    width: PAGE_W,
    height: 110,
    color: COLOR_EMERALD,
  })
  // Banda inferior del header
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 120,
    width: PAGE_W,
    height: 10,
    color: COLOR_TEAL,
  })

  const plantelNombre = data.plantel?.nombre || 'Plantel'
  const periodo = data.plantel?.periodoActual || data.section?.periodoEscolar || '2024-2025'

  // Título superior
  page.drawText('CARNET ESTUDIANTIL', {
    x: 16,
    y: PAGE_H - 24,
    size: 9,
    font: fontBold,
    color: COLOR_WHITE,
  })
  // Sistema
  page.drawText('Sistema de Asistencia · Lista', {
    x: 16,
    y: PAGE_H - 36,
    size: 6.5,
    font: fontOblique,
    color: rgb(0.85, 0.95, 0.9),
  })

  // Plantel nombre (lado derecho del header)
  const plantelText = plantelNombre.length > 26 ? plantelNombre.slice(0, 25) + '…' : plantelNombre
  const plantelWidth = fontBold.widthOfTextAtSize(plantelText, 10)
  page.drawText(plantelText, {
    x: PAGE_W - plantelWidth - 16,
    y: PAGE_H - 22,
    size: 10,
    font: fontBold,
    color: COLOR_WHITE,
  })
  const periodoWidth = fontRegular.widthOfTextAtSize(periodo, 7.5)
  page.drawText(periodo, {
    x: PAGE_W - periodoWidth - 16,
    y: PAGE_H - 34,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.85, 0.95, 0.9),
  })

  // === Cuerpo del frontal ===
  const bodyTop = PAGE_H - 120 // = 300
  const bodyBottom = HALF_H + 4 // 214 (justo encima de la línea de pliegue)
  const bodyHeight = bodyTop - bodyBottom // ~86pt

  // Fondo claro
  page.drawRectangle({
    x: 0,
    y: bodyBottom,
    width: PAGE_W,
    height: bodyHeight,
    color: COLOR_LIGHT_EMERALD,
  })

  // Foto del estudiante
  const photoSize = 70 // pt
  const photoX = 16
  const photoY = bodyBottom + (bodyHeight - photoSize) / 2
  const photo = await fetchPhotoBuffer(data.fotoKey)
  if (photo) {
    try {
      const embedded =
        photo.format === 'png'
          ? await pdfDoc.embedPng(photo.bytes)
          : await pdfDoc.embedJpg(photo.bytes)
      // Mantener proporción (cuadrada)
      page.drawRectangle({
        x: photoX - 2,
        y: photoY - 2,
        width: photoSize + 4,
        height: photoSize + 4,
        color: COLOR_WHITE,
      })
      page.drawImage(embedded, {
        x: photoX,
        y: photoY,
        width: photoSize,
        height: photoSize,
      })
    } catch {
      drawInitialsBox(page, photoX, photoY, photoSize, data.nombre, data.apellido, fontBold, COLOR_EMERALD, COLOR_WHITE)
    }
  } else {
    drawInitialsBox(page, photoX, photoY, photoSize, data.nombre, data.apellido, fontBold, COLOR_EMERALD, COLOR_WHITE)
  }

  // Nombre y datos (a la derecha de la foto)
  const textX = photoX + photoSize + 14
  const textW = PAGE_W - textX - 16

  // Nombre
  const nombreCompleto = `${data.nombre} ${data.apellido}`
  let nombreSize = 14
  while (fontBold.widthOfTextAtSize(nombreCompleto, nombreSize) > textW && nombreSize > 9) {
    nombreSize -= 0.5
  }
  page.drawText(truncateToWidth(nombreCompleto, textW, fontBold, nombreSize), {
    x: textX,
    y: bodyTop - 18,
    size: nombreSize,
    font: fontBold,
    color: COLOR_DARK,
  })

  // Cédula escolar
  const cedulaLine = data.cedulaEscolar
    ? `Cédula escolar: ${data.cedulaEscolar}`
    : 'Cédula escolar: —'
  page.drawText(truncateToWidth(cedulaLine, textW, fontRegular, 9), {
    x: textX,
    y: bodyTop - 34,
    size: 9,
    font: fontRegular,
    color: COLOR_GRAY,
  })

  // Sección
  if (data.section) {
    const turno = turnoLabel[data.section.turno] || data.section.turno
    const sectionLine = `Sección: ${data.section.nombre} · ${turno}`
    page.drawText(truncateToWidth(sectionLine, textW, fontRegular, 9), {
      x: textX,
      y: bodyTop - 48,
      size: 9,
      font: fontRegular,
      color: COLOR_GRAY,
    })
    const gradoLine = `Grado: ${data.section.grado} · Período ${data.section.periodoEscolar}`
    page.drawText(truncateToWidth(gradoLine, textW, fontRegular, 8.5), {
      x: textX,
      y: bodyTop - 60,
      size: 8.5,
      font: fontRegular,
      color: COLOR_GRAY,
    })
  }

  // Género + edad
  const edad = calcularEdad(data.fechaNacimiento)
  const extras: string[] = []
  if (data.genero && generoLabel[data.genero]) extras.push(generoLabel[data.genero]!)
  if (edad) extras.push(edad)
  if (extras.length > 0) {
    page.drawText(extras.join(' · '), {
      x: textX,
      y: bodyTop - 72,
      size: 8.5,
      font: fontOblique,
      color: COLOR_GRAY,
    })
  }

  // ====== LÍNEA DE PLIEGUE (centro de la página) ======
  drawDashedLine(page, 8, PAGE_W - 8, HALF_H, COLOR_LINE, 0.5, 3, 2)
  const foldLabel = '- - - - - - - - pliegue - - - - - - - -'
  const foldW = fontRegular.widthOfTextAtSize(foldLabel, 6)
  page.drawText(foldLabel, {
    x: (PAGE_W - foldW) / 2,
    y: HALF_H - 6,
    size: 6,
    font: fontRegular,
    color: COLOR_GRAY,
  })

  // ====== REVERSO (mitad inferior) ======
  const backTop = HALF_H - 4 // 206
  const backBottom = 0

  // Fondo claro en la mitad
  page.drawRectangle({
    x: 0,
    y: backBottom,
    width: PAGE_W,
    height: backTop - backBottom,
    color: COLOR_WHITE,
  })

  // Banda superior del reverso
  page.drawRectangle({
    x: 0,
    y: backTop - 28,
    width: PAGE_W,
    height: 28,
    color: COLOR_EMERALD_DARK,
  })
  page.drawText('VERIFICACIÓN', {
    x: 16,
    y: backTop - 19,
    size: 9,
    font: fontBold,
    color: COLOR_WHITE,
  })

  // Generar QR (PNG)
  const qrPng = await QRCode.toBuffer(data.qrCode, {
    type: 'png',
    width: 300,
    margin: 1,
    color: { dark: '#065740', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })
  const qrImage = await pdfDoc.embedPng(qrPng)
  const qrSize = 92 // pt
  const qrX = (PAGE_W - qrSize) / 2
  const qrY = backTop - 28 - qrSize - 8

  // Marco blanco detrás del QR
  page.drawRectangle({
    x: qrX - 4,
    y: qrY - 4,
    width: qrSize + 8,
    height: qrSize + 8,
    color: COLOR_WHITE,
    borderColor: COLOR_EMERALD,
    borderWidth: 1,
  })
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

  // Texto "Escanea este código"
  const scanText = 'Escanea este código para verificar'
  const scanW = fontRegular.widthOfTextAtSize(scanText, 8.5)
  page.drawText(scanText, {
    x: (PAGE_W - scanW) / 2,
    y: qrY - 14,
    size: 8.5,
    font: fontRegular,
    color: COLOR_GRAY,
  })

  // Código único
  const codigoLabel = 'Código del estudiante'
  const codigoLabelW = fontRegular.widthOfTextAtSize(codigoLabel, 7)
  page.drawText(codigoLabel, {
    x: (PAGE_W - codigoLabelW) / 2,
    y: qrY - 28,
    size: 7,
    font: fontRegular,
    color: COLOR_GRAY,
  })
  const codigoValue = data.codigoUnico
  const codigoValueW = fontBold.widthOfTextAtSize(codigoValue, 9)
  page.drawText(codigoValue, {
    x: (PAGE_W - codigoValueW) / 2,
    y: qrY - 40,
    size: 9,
    font: fontBold,
    color: COLOR_EMERALD_DARK,
  })

  // Validez
  const validText = `Válido para el período escolar ${periodo}`
  const validW = fontRegular.widthOfTextAtSize(validText, 7.5)
  page.drawText(validText, {
    x: (PAGE_W - validW) / 2,
    y: qrY - 54,
    size: 7.5,
    font: fontOblique,
    color: COLOR_GRAY,
  })

  // Footer con dirección del plantel
  const direccion = data.plantel?.direccion?.trim()
  if (direccion) {
    const dirLabel = 'Plantel:'
    const dirLabelW = fontRegular.widthOfTextAtSize(dirLabel, 7)
    page.drawText(dirLabel, {
      x: 16,
      y: 14,
      size: 7,
      font: fontBold,
      color: COLOR_GRAY,
    })
    page.drawText(truncateToWidth(direccion, PAGE_W - 16 - dirLabelW - 8 - 16, fontRegular, 7), {
      x: 16 + dirLabelW + 4,
      y: 14,
      size: 7,
      font: fontRegular,
      color: COLOR_GRAY,
    })
  }

  // Esquina inferior derecha: identificación del sistema
  const footerText = 'Lista · Sistema de Asistencia'
  const footerW = fontOblique.widthOfTextAtSize(footerText, 6.5)
  page.drawText(footerText, {
    x: PAGE_W - footerW - 12,
    y: 8,
    size: 6.5,
    font: fontOblique,
    color: COLOR_GRAY,
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
