// Utilidades compartidas para las vistas del representante.

const R_EARTH = 6371000 // metros

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

// Distancia haversine en metros entre dos puntos (lat,lng).
export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R_EARTH * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Convierte metros a una cadena legible (m / km).
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(2)} km`
}

// Formatea tiempo relativo en español: "hace 5 min", "hace 2 h", "hace 3 días".
export function formatRelative(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  const diffMs = Date.now() - date.getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 30) return 'hace un momento'
  if (sec < 60) return `hace ${sec} s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const days = Math.floor(h / 24)
  if (days < 30) return `hace ${days} día${days === 1 ? '' : 's'}`
  return date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })
}

export function formatTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  try {
    return d.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return '--:--'
  }
}

export function formatDateLong(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  try {
    return d.toLocaleDateString('es-VE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export function formatDateShort(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  try {
    return d.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export function isToday(iso: string | Date): boolean {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// Etiquetas legibles para los estados de asistencia.
export const ESTADO_LABELS: Record<string, string> = {
  presente: 'Presente',
  ausente: 'Ausente',
  tardanza: 'Tardanza',
  justificado: 'Justificado',
}

// Mapeo de estados a clases Tailwind.
export function estadoStyle(estado: string): {
  bg: string
  text: string
  border: string
  dot: string
} {
  switch (estado) {
    case 'presente':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-300 dark:border-emerald-800',
        dot: 'bg-emerald-500',
      }
    case 'ausente':
      return {
        bg: 'bg-red-50 dark:bg-red-950/30',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-300 dark:border-red-800',
        dot: 'bg-red-500',
      }
    case 'tardanza':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-300 dark:border-amber-800',
        dot: 'bg-amber-500',
      }
    case 'justificado':
      return {
        bg: 'bg-teal-50 dark:bg-teal-950/30',
        text: 'text-teal-700 dark:text-teal-300',
        border: 'border-teal-300 dark:border-teal-800',
        dot: 'bg-teal-500',
      }
    default:
      return {
        bg: 'bg-muted/40',
        text: 'text-muted-foreground',
        border: 'border-muted',
        dot: 'bg-muted-foreground',
      }
  }
}

// Mapeo de tipos de notificación a estilos.
export function notifStyle(tipo: string): {
  bg: string
  text: string
  icon: string
} {
  switch (tipo) {
    case 'ausencia':
    case 'ausente':
      return {
        bg: 'bg-red-100 dark:bg-red-950/50',
        text: 'text-red-700 dark:text-red-300',
        icon: 'text-red-600',
      }
    case 'tardanza':
      return {
        bg: 'bg-amber-100 dark:bg-amber-950/50',
        text: 'text-amber-700 dark:text-amber-300',
        icon: 'text-amber-600',
      }
    case 'feed':
      return {
        bg: 'bg-teal-100 dark:bg-teal-950/50',
        text: 'text-teal-700 dark:text-teal-300',
        icon: 'text-teal-600',
      }
    case 'salida_plantel':
      return {
        bg: 'bg-orange-100 dark:bg-orange-950/50',
        text: 'text-orange-700 dark:text-orange-300',
        icon: 'text-orange-600',
      }
    case 'checkin':
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-950/50',
        text: 'text-emerald-700 dark:text-emerald-300',
        icon: 'text-emerald-600',
      }
    case 'general':
    default:
      return {
        bg: 'bg-muted',
        text: 'text-muted-foreground',
        icon: 'text-muted-foreground',
      }
  }
}
