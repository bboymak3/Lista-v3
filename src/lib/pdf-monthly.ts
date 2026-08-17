/**
 * PDF generator for monthly attendance reports.
 * Uses pdf-lib (works on Cloudflare Workers and Node).
 *
 * Output is a Uint8Array of PDF bytes, ready to be returned as `Response` body.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

// ── Color palette (emerald/teal theme) ─────────────────────────
const COLORS = {
  primary: rgb(0.043, 0.376, 0.337), // emerald-700
  primaryLight: rgb(0.059, 0.514, 0.475), // teal-600
  accent: rgb(0.059, 0.624, 0.522), // emerald-500
  headerBg: rgb(0.882, 0.961, 0.937), // emerald-50-ish
  text: rgb(0.094, 0.114, 0.122), // near-black
  textMuted: rgb(0.42, 0.45, 0.48),
  border: rgb(0.86, 0.88, 0.88),
  rowAlt: rgb(0.972, 0.992, 0.98),
  white: rgb(1, 1, 1),
  // Estado colors
  presente: rgb(0.059, 0.514, 0.475),
  ausente: rgb(0.788, 0.165, 0.165),
  tardanza: rgb(0.851, 0.604, 0.0),
  justificado: rgb(0.0, 0.424, 0.486),
}

const ESTADO_LABEL: Record<string, string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  tardanza: 'Tardanza',
  justificado: 'Justificado',
}

const MONTH_LABELS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export interface MonthlyPdfStudent {
  nombre: string
  apellido: string
  cedulaEscolar: string | null
  codigoUnico: string
  sectionNombre: string
  sectionGrado: string
  sectionTurno: string
  plantelNombre: string
  plantelDireccion?: string | null
}

export interface MonthlyPdfRecord {
  fecha: string // ISO string
  estado: string
  origen: string
}

export interface MonthlyPdfStats {
  total: number
  presentes: number
  ausentes: number
  tardanzas: number
  justificados: number
  pct: number
}

export interface MonthlyPdfInput {
  student: MonthlyPdfStudent
  month: string // YYYY-MM (e.g. "2024-08")
  stats: MonthlyPdfStats
  records: MonthlyPdfRecord[]
  generatedAt: Date
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function formatDateLong(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function formatDateVerbose(d: Date): string {
  const wd = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d.getDay()]
  const mn = MONTH_LABELS_ES[d.getMonth()]
  return `${wd}, ${d.getDate()} de ${mn} de ${d.getFullYear()}`
}

function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function estadoLabel(estado: string): string {
  return ESTADO_LABEL[estado] || estado
}

function estadoColor(estado: string): rgb {
  if (estado === 'presente') return COLORS.presente
  if (estado === 'ausente') return COLORS.ausente
  if (estado === 'tardanza') return COLORS.tardanza
  if (estado === 'justificado') return COLORS.justificado
  return COLORS.textMuted
}

/**
 * Build the monthly attendance PDF.
 * Returns the encoded bytes.
 */
export async function buildMonthlyAttendancePdf(input: MonthlyPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Reporte de Asistencia Mensual - ${input.student.nombre} ${input.student.apellido}`)
  doc.setAuthor('Sistema de Asistencia Escolar')
  doc.setSubject(`Asistencia ${input.month}`)
  doc.setProducer('Lista v3')
  doc.setCreator('Lista v3')

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  // ── Page constants ──
  const PAGE_W = 595.28 // A4 portrait width in pt
  const PAGE_H = 841.89
  const MARGIN_X = 40
  const CONTENT_W = PAGE_W - MARGIN_X * 2
  let y = PAGE_H - 40

  const page = doc.addPage([PAGE_W, PAGE_H])

  // ── Helpers ──
  const activePageRef: { page: typeof page } = { page }

  const drawText2 = (text: string, x: number, size: number, opts: { font?: typeof font; color?: rgb; maxW?: number } = {}) => {
    const f = opts.font || font
    const color = opts.color || COLORS.text
    const ap = activePageRef.page
    if (opts.maxW) {
      const words = text.split(' ')
      let line = ''
      const lines: string[] = []
      for (const w of words) {
        const candidate = line ? `${line} ${w}` : w
        if (f.widthOfTextAtSize(candidate, size) > opts.maxW && line) {
          lines.push(line)
          line = w
        } else {
          line = candidate
        }
      }
      if (line) lines.push(line)
      for (const l of lines) {
        ap.drawText(l, { x, y, size, font: f, color })
        y -= size + 2
      }
    } else {
      ap.drawText(text, { x, y, size, font: f, color })
      y -= size + 4
    }
  }

  const drawLine2 = (x1: number, x2: number, color: rgb = COLORS.border, thickness = 0.5) => {
    activePageRef.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color })
  }

  // ── HEADER BAND ──
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 90,
    width: PAGE_W,
    height: 90,
    color: COLORS.primary,
  })
  // Accent thin bar
  page.drawRectangle({
    x: 0,
    y: PAGE_H - 94,
    width: PAGE_W,
    height: 4,
    color: COLORS.accent,
  })

  page.drawText('Reporte de Asistencia Mensual', {
    x: MARGIN_X,
    y: PAGE_H - 38,
    size: 20,
    font: bold,
    color: COLORS.white,
  })
  page.drawText(input.student.plantelNombre, {
    x: MARGIN_X,
    y: PAGE_H - 60,
    size: 12,
    font: font,
    color: COLORS.white,
  })
  if (input.student.plantelDireccion) {
    page.drawText(input.student.plantelDireccion, {
      x: MARGIN_X,
      y: PAGE_H - 75,
      size: 9,
      font: font,
      color: rgb(0.85, 0.92, 0.88),
    })
  }
  // Generated at (right side)
  page.drawText('Generado:', {
    x: PAGE_W - MARGIN_X - 140,
    y: PAGE_H - 38,
    size: 9,
    font: font,
    color: rgb(0.85, 0.92, 0.88),
  })
  page.drawText(formatDateVerbose(input.generatedAt), {
    x: PAGE_W - MARGIN_X - 140,
    y: PAGE_H - 52,
    size: 9,
    font: bold,
    color: COLORS.white,
  })
  page.drawText(formatTime(input.generatedAt), {
    x: PAGE_W - MARGIN_X - 140,
    y: PAGE_H - 65,
    size: 9,
    font: font,
    color: rgb(0.85, 0.92, 0.88),
  })

  // Reset y below header band
  y = PAGE_H - 120

  // ── STUDENT INFO ──
  drawText2('Datos del estudiante', MARGIN_X, 13, { font: bold, color: COLORS.primary })
  drawLine2(MARGIN_X, MARGIN_X + CONTENT_W, COLORS.primary, 1)
  y -= 6

  const turnoLabel: Record<string, string> = {
    manana: 'Mañana',
    tarde: 'Tarde',
    nocturno: 'Nocturno',
  }
  const infoRows: [string, string][] = [
    ['Nombre:', `${input.student.nombre} ${input.student.apellido}`],
    ['Cédula escolar:', input.student.cedulaEscolar || '—'],
    ['Código único:', input.student.codigoUnico],
    ['Sección:', input.student.sectionNombre],
    ['Grado:', `${input.student.sectionGrado}°`],
    ['Turno:', turnoLabel[input.student.sectionTurno] || input.student.sectionTurno],
  ]
  for (const [label, value] of infoRows) {
    drawText2(label, MARGIN_X, 10.5, { font: bold, color: COLORS.text })
    // Value indented
    page.drawText(value, {
      x: MARGIN_X + 110,
      y: y + 4,
      size: 10.5,
      font,
      color: COLORS.textMuted,
    })
    y -= 16
  }

  y -= 8

  // ── MONTH/YEAR ──
  const [yearStr, monthStr] = input.month.split('-')
  const monthIdx = parseInt(monthStr, 10) - 1
  const monthName = MONTH_LABELS_ES[monthIdx] || monthStr
  drawText2(`Período: ${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${yearStr}`, MARGIN_X, 13, {
    font: bold,
    color: COLORS.primary,
  })
  drawLine2(MARGIN_X, MARGIN_X + CONTENT_W, COLORS.primary, 1)
  y -= 8

  // ── SUMMARY STATS ──
  drawText2('Resumen de asistencia', MARGIN_X, 12, { font: bold, color: COLORS.primary })
  drawLine2(MARGIN_X, MARGIN_X + CONTENT_W, COLORS.border, 0.5)
  y -= 8

  // Stats grid: 5 stat cards (total, presentes, ausentes, tardanzas, justificados) + 1 % card
  const cardW = (CONTENT_W - 5 * 6) / 6
  const cardH = 46
  const statsCards: { label: string; value: string; color: rgb }[] = [
    { label: 'Total días', value: String(input.stats.total), color: COLORS.primary },
    { label: 'Presentes', value: String(input.stats.presentes), color: COLORS.presente },
    { label: 'Ausentes', value: String(input.stats.ausentes), color: COLORS.ausente },
    { label: 'Tardanzas', value: String(input.stats.tardanzas), color: COLORS.tardanza },
    { label: 'Justificados', value: String(input.stats.justificados), color: COLORS.justificado },
    { label: '% Asistencia', value: `${input.stats.pct}%`, color: COLORS.accent },
  ]
  for (let i = 0; i < statsCards.length; i++) {
    const cx = MARGIN_X + i * (cardW + 6)
    const card = statsCards[i]
    activePageRef.page.drawRectangle({
      x: cx,
      y: y - cardH + 4,
      width: cardW,
      height: cardH,
      color: COLORS.headerBg,
      borderColor: COLORS.border,
      borderWidth: 0.5,
    })
    // Accent top bar
    activePageRef.page.drawRectangle({
      x: cx,
      y: y + 4 - 3,
      width: cardW,
      height: 3,
      color: card.color,
    })
    activePageRef.page.drawText(card.label, {
      x: cx + 6,
      y: y - 12,
      size: 8,
      font,
      color: COLORS.textMuted,
    })
    activePageRef.page.drawText(card.value, {
      x: cx + 6,
      y: y - 28,
      size: 16,
      font: bold,
      color: card.color,
    })
  }
  y -= cardH + 8

  // ── DAILY BREAKDOWN TABLE ──
  drawText2('Detalle diario', MARGIN_X, 12, { font: bold, color: COLORS.primary })
  drawLine2(MARGIN_X, MARGIN_X + CONTENT_W, COLORS.border, 0.5)
  y -= 8

  // Table header
  const colFecha = MARGIN_X
  const colEstado = MARGIN_X + 230
  const colOrigen = MARGIN_X + 360
  const tableBottom = 80
  const rowH = 18
  const headerH = 20

  const drawTableHeader = () => {
    activePageRef.page.drawRectangle({
      x: colFecha,
      y: y - headerH + 4,
      width: CONTENT_W,
      height: headerH,
      color: COLORS.primary,
    })
    activePageRef.page.drawText('Fecha', { x: colFecha + 6, y: y - 12, size: 9, font: bold, color: COLORS.white })
    activePageRef.page.drawText('Estado', { x: colEstado + 6, y: y - 12, size: 9, font: bold, color: COLORS.white })
    activePageRef.page.drawText('Origen', { x: colOrigen + 6, y: y - 12, size: 9, font: bold, color: COLORS.white })
    y -= headerH + 2
  }
  drawTableHeader()

  // Rows
  for (let i = 0; i < input.records.length; i++) {
    const r = input.records[i]
    // Page break
    if (y - rowH < tableBottom) {
      // New page
      const newPage = doc.addPage([PAGE_W, PAGE_H])
      activePageRef.page = newPage
      y = PAGE_H - 40
      // Header band (smaller for subsequent pages)
      newPage.drawRectangle({
        x: 0,
        y: PAGE_H - 40,
        width: PAGE_W,
        height: 40,
        color: COLORS.primary,
      })
      newPage.drawText('Reporte de Asistencia Mensual (continuación)', {
        x: MARGIN_X,
        y: PAGE_H - 26,
        size: 11,
        font: bold,
        color: COLORS.white,
      })
      newPage.drawText(`${input.student.nombre} ${input.student.apellido} · ${input.month}`, {
        x: MARGIN_X,
        y: PAGE_H - 38,
        size: 8,
        font,
        color: rgb(0.85, 0.92, 0.88),
      })
      y = PAGE_H - 56
      drawTableHeader()
    }

    const bg = i % 2 === 0 ? COLORS.rowAlt : COLORS.white
    activePageRef.page.drawRectangle({
      x: colFecha,
      y: y - rowH + 4,
      width: CONTENT_W,
      height: rowH,
      color: bg,
    })
    // Estado color dot
    const dotColor = estadoColor(r.estado)
    activePageRef.page.drawRectangle({
      x: colEstado - 8,
      y: y - 11,
      width: 6,
      height: 6,
      color: dotColor,
    })

    // Date
    const d = new Date(r.fecha)
    let fechaTxt: string
    if (isNaN(d.getTime())) {
      fechaTxt = r.fecha
    } else {
      fechaTxt = `${formatDateLong(d)} ${formatTime(d)}`
    }
    activePageRef.page.drawText(fechaTxt, {
      x: colFecha + 6,
      y: y - 12,
      size: 9,
      font,
      color: COLORS.text,
    })
    activePageRef.page.drawText(estadoLabel(r.estado), {
      x: colEstado + 6,
      y: y - 12,
      size: 9,
      font: bold,
      color: dotColor,
    })
    activePageRef.page.drawText(r.origen, {
      x: colOrigen + 6,
      y: y - 12,
      size: 9,
      font,
      color: COLORS.textMuted,
    })
    // Row separator
    activePageRef.page.drawLine({
      start: { x: colFecha, y: y - rowH + 4 },
      end: { x: colFecha + CONTENT_W, y: y - rowH + 4 },
      thickness: 0.25,
      color: COLORS.border,
    })
    y -= rowH
  }

  // ── FOOTER (firmas) ──
  // Always on a new page if too low
  if (y < 220) {
    const newPage = doc.addPage([PAGE_W, PAGE_H])
    activePageRef.page = newPage
    y = PAGE_H - 40
  } else {
    y -= 30
  }

  // Generation info
  drawText2(`Reporte generado el ${formatDateVerbose(input.generatedAt)} a las ${formatTime(input.generatedAt)}`, MARGIN_X, 9, {
    color: COLORS.textMuted,
  })
  y -= 16
  drawText2(`Sistema de Asistencia Escolar · Plantel: ${input.student.plantelNombre}`, MARGIN_X, 9, {
    color: COLORS.textMuted,
  })
  y -= 30

  // Firmas lines
  drawText2('Firmas', MARGIN_X, 11, { font: bold, color: COLORS.primary })
  drawLine2(MARGIN_X, MARGIN_X + CONTENT_W, COLORS.border, 0.5)
  y -= 30

  const firmaW = (CONTENT_W - 40) / 2
  const firmaY = y
  // Line 1: representante
  activePageRef.page.drawLine({
    start: { x: MARGIN_X, y: firmaY },
    end: { x: MARGIN_X + firmaW, y: firmaY },
    thickness: 0.7,
    color: COLORS.text,
  })
  activePageRef.page.drawText('Firma del representante', {
    x: MARGIN_X,
    y: firmaY - 14,
    size: 9,
    font,
    color: COLORS.textMuted,
  })
  // Line 2: sello plantel
  activePageRef.page.drawLine({
    start: { x: MARGIN_X + firmaW + 40, y: firmaY },
    end: { x: MARGIN_X + CONTENT_W, y: firmaY },
    thickness: 0.7,
    color: COLORS.text,
  })
  activePageRef.page.drawText('Sello del plantel', {
    x: MARGIN_X + firmaW + 40,
    y: firmaY - 14,
    size: 9,
    font,
    color: COLORS.textMuted,
  })

  // ── PAGE FOOTERS (page numbers) on every page ──
  const pages = doc.getPages()
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    p.drawText(`Página ${i + 1} de ${pages.length}`, {
      x: PAGE_W - MARGIN_X - 70,
      y: 20,
      size: 8,
      font,
      color: COLORS.textMuted,
    })
    p.drawText('Lista v3 — Sistema de Asistencia Escolar', {
      x: MARGIN_X,
      y: 20,
      size: 8,
      font,
      color: COLORS.textMuted,
    })
  }

  return await doc.save()
}
