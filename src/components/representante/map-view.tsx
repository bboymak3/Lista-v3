'use client'

import { useMemo } from 'react'
import { haversineM, formatDistance } from './utils'

interface Plantel {
  lat: number
  lng: number
  radioM: number
  nombre: string
}
interface StudentPos {
  lat: number
  lng: number
  timestamp: string
  precision: number | null
}

interface MapViewProps {
  plantel: Plantel
  student: StudentPos | null
  stale?: boolean
}

// viewBox fijo
const VB_W = 400
const VB_H = 300
const PADDING = 28

function niceStep(value: number): number {
  if (value <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(value)))
  const norm = value / pow
  let stepNorm: number
  if (norm < 1.5) stepNorm = 1
  else if (norm < 3) stepNorm = 2
  else if (norm < 7) stepNorm = 5
  else stepNorm = 10
  return stepNorm * pow
}

// Proyección equirectangular simple — convierte lat/lng a metros relativos
// a un punto de referencia (refLat, refLng).
function project(
  lat: number,
  lng: number,
  refLat: number,
  refLng: number
): { x: number; y: number } {
  const latRad = (refLat * Math.PI) / 180
  const metersPerDegLat = 111320
  const metersPerDegLng = 111320 * Math.cos(latRad)
  return {
    x: (lng - refLng) * metersPerDegLng,
    y: (lat - refLat) * metersPerDegLat,
  }
}

export function MapView({ plantel, student, stale }: MapViewProps) {
  // Calcular referencia y escala
  const { refLat, refLng, scale, distance, showStudent } = useMemo(() => {
    if (!student) {
      // Solo plantel: centrar el plantel y escalar para que el radio quepa
      const targetRadiusSvg = Math.min(VB_W, VB_H) / 2 - PADDING - 10
      const scale = targetRadiusSvg / Math.max(plantel.radioM, 1)
      return {
        refLat: plantel.lat,
        refLng: plantel.lng,
        scale,
        distance: 0,
        showStudent: false,
      }
    }
    const p = project(plantel.lat, plantel.lng, plantel.lat, plantel.lng)
    const s = project(student.lat, student.lng, plantel.lat, plantel.lng)
    const distM = haversineM(plantel.lat, plantel.lng, student.lat, student.lng)
    // Max radio a mostrar = max(radio geocerca, distancia a estudiante)
    const maxExtentM = Math.max(plantel.radioM, distM, 20)
    // Queremos que este radio ocupe targetRadiusSvg (dejando padding)
    const targetRadiusSvg = Math.min(VB_W, VB_H) / 2 - PADDING - 8
    const scale = targetRadiusSvg / maxExtentM

    return {
      refLat: plantel.lat,
      refLng: plantel.lng,
      scale,
      distance: distM,
      showStudent: true,
    }
  }, [plantel.lat, plantel.lng, plantel.radioM, student])

  // Centro del plantel en SVG: lo mantenemos en el centro del viewBox
  const cx = VB_W / 2
  const cy = VB_H / 2

  // Plantel siempre en (cx, cy) porque refLat/Lng = plantel coords
  const plantelSvg = { x: cx, y: cy }
  // Radio del plantel en SVG
  const plantelRadiusSvg = Math.max(8, plantel.radioM * scale)

  // Posición del estudiante en SVG (y invertida: norte = arriba)
  const studentSvg = useMemo(() => {
    if (!student) return null
    const p = project(student.lat, student.lng, refLat, refLng)
    return { x: cx + p.x * scale, y: cy - p.y * scale }
  }, [student, refLat, refLng, scale, cx, cy])

  // Cuadrícula: pasos en metros
  const stepM = useMemo(() => {
    // Step de cuadrícula visible cada ~40 SVG unidades
    const targetSvgStep = 40
    const stepMeters = targetSvgStep / scale
    return niceStep(stepMeters)
  }, [scale])

  const stepSvg = useMemo(() => stepM * scale, [stepM, scale])

  // Líneas de cuadrícula
  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; label?: string; vertical: boolean; pos: number }[] = []
    if (stepSvg <= 0) return lines
    // Verticales: desde cx hacia ambos lados
    let i = 1
    while (cx + i * stepSvg < VB_W - PADDING / 2) {
      const x = cx + i * stepSvg
      lines.push({ x1: x, y1: PADDING / 2, x2: x, y2: VB_H - PADDING / 2, vertical: true, pos: i * stepM })
      i++
    }
    i = 1
    while (cx - i * stepSvg > PADDING / 2) {
      const x = cx - i * stepSvg
      lines.push({ x1: x, y1: PADDING / 2, x2: x, y2: VB_H - PADDING / 2, vertical: true, pos: -i * stepM })
      i++
    }
    // Horizontales: desde cy hacia ambos lados
    i = 1
    while (cy + i * stepSvg < VB_H - PADDING / 2) {
      const y = cy + i * stepSvg
      lines.push({ x1: PADDING / 2, y1: y, x2: VB_W - PADDING / 2, y2: y, vertical: false, pos: -i * stepM })
      i++
    }
    i = 1
    while (cy - i * stepSvg > PADDING / 2) {
      const y = cy - i * stepSvg
      lines.push({ x1: PADDING / 2, y1: y, x2: VB_W - PADDING / 2, y2: y, vertical: false, pos: i * stepM })
      i++
    }
    return lines
  }, [stepSvg, stepM, cx, cy])

  // Punto medio de la línea para etiqueta de distancia
  const midPoint = studentSvg
    ? { x: (plantelSvg.x + studentSvg.x) / 2, y: (plantelSvg.y + studentSvg.y) / 2 }
    : null

  return (
    <div className="relative w-full overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-auto block"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Mapa de ubicación del estudiante respecto al plantel"
      >
        {/* Fondo */}
        <defs>
          <pattern
            id="map-grid"
            width={stepSvg > 0 ? stepSvg : 40}
            height={stepSvg > 0 ? stepSvg : 40}
            patternUnits="userSpaceOnUse"
            x={cx}
            y={cy}
          >
            <path
              d={`M ${stepSvg > 0 ? stepSvg : 40} 0 L 0 0 0 ${stepSvg > 0 ? stepSvg : 40}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.12"
              strokeWidth="0.5"
            />
          </pattern>
          <radialGradient id="plantel-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
            <stop offset="70%" stopColor="#10b981" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.03" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#map-grid)" className="text-emerald-700 dark:text-emerald-300" />

        {/* Ejes principales (cross) */}
        <line
          x1={PADDING / 2}
          y1={cy}
          x2={VB_W - PADDING / 2}
          y2={cy}
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="0.8"
          className="text-emerald-700 dark:text-emerald-300"
        />
        <line
          x1={cx}
          y1={PADDING / 2}
          x2={cx}
          y2={VB_H - PADDING / 2}
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="0.8"
          className="text-emerald-700 dark:text-emerald-300"
        />

        {/* Cuadrícula numerada (etiquetas cada 2 líneas) */}
        {gridLines.map((line, idx) => {
          if (Math.abs(line.pos / stepM) % 2 !== 0) return null
          if (line.vertical) {
            return (
              <g key={`v${idx}`}>
                <text
                  x={line.x1}
                  y={VB_H - 4}
                  fontSize="7"
                  fill="currentColor"
                  fillOpacity="0.4"
                  textAnchor="middle"
                  className="text-emerald-700 dark:text-emerald-300"
                >
                  {line.pos > 0 ? `E${Math.round(line.pos)}m` : `O${Math.abs(Math.round(line.pos))}m`}
                </text>
              </g>
            )
          }
          return (
            <g key={`h${idx}`}>
              <text
                x={4}
                y={line.y1 + 2}
                fontSize="7"
                fill="currentColor"
                fillOpacity="0.4"
                className="text-emerald-700 dark:text-emerald-300"
              >
                {line.pos > 0 ? `N${Math.round(line.pos)}` : `S${Math.abs(Math.round(line.pos))}m`}
              </text>
            </g>
          )
        })}

        {/* Geocerca del plantel */}
        <circle
          cx={plantelSvg.x}
          cy={plantelSvg.y}
          r={plantelRadiusSvg}
          fill="url(#plantel-fill)"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <circle
          cx={plantelSvg.x}
          cy={plantelSvg.y}
          r={Math.min(plantelRadiusSvg, 8)}
          fill="#10b981"
          fillOpacity="0.15"
        />

        {/* Línea planta -> estudiante */}
        {showStudent && studentSvg && (
          <>
            <line
              x1={plantelSvg.x}
              y1={plantelSvg.y}
              x2={studentSvg.x}
              y2={studentSvg.y}
              stroke="#0d9488"
              strokeWidth="1.5"
              strokeDasharray="3 2"
              opacity="0.7"
            />
            {/* Etiqueta de distancia */}
            {midPoint && (
              <g>
                <rect
                  x={midPoint.x - 28}
                  y={midPoint.y - 9}
                  width="56"
                  height="14"
                  rx="3"
                  fill="white"
                  fillOpacity="0.92"
                  stroke="#0d9488"
                  strokeWidth="0.5"
                />
                <text
                  x={midPoint.x}
                  y={midPoint.y + 1}
                  fontSize="9"
                  fontWeight="600"
                  fill="#0f766e"
                  textAnchor="middle"
                >
                  {formatDistance(distance)}
                </text>
              </g>
            )}
          </>
        )}

        {/* Marcador del plantel */}
        <g>
          <circle
            cx={plantelSvg.x}
            cy={plantelSvg.y}
            r="7"
            fill="#059669"
            stroke="white"
            strokeWidth="2"
          />
          {/* Edificio del plantel (icono) */}
          <path
            d={`M ${plantelSvg.x - 3} ${plantelSvg.y + 1} L ${plantelSvg.x} ${plantelSvg.y - 3} L ${plantelSvg.x + 3} ${plantelSvg.y + 1} Z`}
            fill="white"
          />
        </g>
        <text
          x={plantelSvg.x}
          y={plantelSvg.y + 18}
          fontSize="9"
          fontWeight="600"
          fill="#065f46"
          textAnchor="middle"
          className="dark:fill-emerald-200"
        >
          {plantel.nombre.length > 18
            ? plantel.nombre.slice(0, 18) + '…'
            : plantel.nombre}
        </text>

        {/* Marcador del estudiante */}
        {showStudent && studentSvg && (
          <g>
            <circle
              cx={studentSvg.x}
              cy={studentSvg.y}
              r="11"
              fill="#3b82f6"
              fillOpacity="0.18"
              className={stale ? '' : 'animate-pulse'}
            />
            <circle
              cx={studentSvg.x}
              cy={studentSvg.y}
              r="5"
              fill="#3b82f6"
              stroke="white"
              strokeWidth="1.5"
            />
          </g>
        )}

        {/* Brújula N */}
        <g transform={`translate(${VB_W - 22} ${22})`}>
          <circle r="10" fill="white" fillOpacity="0.85" stroke="#0d9488" strokeWidth="0.6" />
          <path d="M 0 -6 L 2 0 L 0 6 L -2 0 Z" fill="#10b981" />
          <text y="-7" fontSize="6" fill="#065f46" textAnchor="middle" fontWeight="700">N</text>
        </g>

        {/* Leyenda esquina inferior izquierda */}
        <g transform={`translate(${PADDING / 2} ${VB_H - PADDING / 2 - 2})`}>
          <circle cx="4" cy="-3" r="3" fill="#059669" />
          <text x="10" y="0" fontSize="7" fill="currentColor" fillOpacity="0.7" className="text-emerald-800 dark:text-emerald-200">Plantel</text>
          {showStudent && (
            <>
              <circle cx="42" cy="-3" r="3" fill="#3b82f6" />
              <text x="48" y="0" fontSize="7" fill="currentColor" fillOpacity="0.7" className="text-emerald-800 dark:text-emerald-200">Estudiante</text>
            </>
          )}
        </g>
      </svg>
    </div>
  )
}
