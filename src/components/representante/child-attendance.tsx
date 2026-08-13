'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { useRepresentanteStore } from '@/stores/representante-store'
import { ChildSelector } from './child-selector'
import {
  ESTADO_LABELS,
  estadoStyle,
  formatTime,
  isSameDay,
} from './utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  ClipboardCheck,
  CalendarDays,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Users,
} from 'lucide-react'

interface AttendanceRecord {
  id: string
  estado: string
  origen: string
  observacion: string | null
  fecha: string
  session: { id: string; fecha: string; estado: string } | null
}

const WEEKDAYS = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá']
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// Construye un mapa fecha (YYYY-MM-DD) -> attendance record, para lookup rápido.
function buildAttendanceMap(records: AttendanceRecord[]): Map<string, AttendanceRecord> {
  const map = new Map<string, AttendanceRecord>()
  for (const r of records) {
    const d = new Date(r.fecha)
    if (isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    // Conservar el registro más reciente por día
    const existing = map.get(key)
    if (!existing || new Date(r.fecha) > new Date(existing.fecha)) {
      map.set(key, r)
    }
  }
  return map
}

export function ChildAttendance() {
  const children = useRepresentanteStore((s) => s.children)
  const selectedChildId = useRepresentanteStore((s) => s.selectedChildId)
  const fetchChildren = useRepresentanteStore((s) => s.fetchChildren)
  const loadingChildren = useRepresentanteStore((s) => s.loading)

  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchChildren()
  }, [fetchChildren])

  const selectedChild = children.find((c) => c.id === selectedChildId) || null

  const loadAttendance = useCallback(async (childId: string) => {
    setLoading(true)
    try {
      const d = await api.get<{ attendance: AttendanceRecord[] }>(
        `/representante/attendance?estudianteId=${childId}`
      )
      setRecords(d.attendance || [])
    } catch (e: unknown) {
      toast.error('Error al cargar asistencia: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedChild) return
    let active = true
    loadAttendance(selectedChild.id).catch(() => {
      // errores ya manejados dentro de loadAttendance
    })
    return () => {
      active = false
    }
  }, [selectedChild?.id, loadAttendance])

  const attendanceMap = useMemo(() => buildAttendanceMap(records), [records])

  // Estadísticas de los últimos 30 días
  const stats = useMemo(() => {
    const total = records.length
    const presentes = records.filter((r) => r.estado === 'presente').length
    const ausentes = records.filter((r) => r.estado === 'ausente').length
    const tardanzas = records.filter((r) => r.estado === 'tardanza').length
    const justificados = records.filter((r) => r.estado === 'justificado').length
    const pct = total > 0 ? Math.round((presentes / total) * 100) : 0
    return { total, presentes, ausentes, tardanzas, justificados, pct }
  }, [records])

  // Calendario de los últimos 30 días (ordenado desc)
  const calendarDays = useMemo(() => {
    const days: { date: Date; record: AttendanceRecord | null }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 0; i < 30; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      const record = attendanceMap.get(key) || null
      days.push({ date: d, record })
    }
    return days
  }, [attendanceMap])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-emerald-600" />
          Asistencia
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Historial de los últimos 30 días
        </p>
      </div>

      <ChildSelector />

      {!loadingChildren && children.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No tienes hijos asociados</p>
          </CardContent>
        </Card>
      )}

      {selectedChild && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Asistencia"
              value={`${stats.pct}%`}
              accent="emerald"
            />
            <StatCard
              icon={<CheckCircle2 className="w-4 h-4" />}
              label="Presentes"
              value={String(stats.presentes)}
              accent="emerald"
            />
            <StatCard
              icon={<XCircle className="w-4 h-4" />}
              label="Ausentes"
              value={String(stats.ausentes)}
              accent="red"
            />
            <StatCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Tardanzas"
              value={String(stats.tardanzas)}
              accent="amber"
            />
          </div>

          {/* Resumen por porcentaje */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-600" />
                Resumen mensual
              </CardTitle>
              <CardDescription>
                {selectedChild.nombre} {selectedChild.apellido} ·{' '}
                {selectedChild.section.nombre}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-4 w-full" />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {stats.total} día{stats.total === 1 ? '' : 's'} con
                      registro
                    </span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {stats.pct}% asistencia
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full overflow-hidden bg-muted flex">
                    {stats.total > 0 && (
                      <>
                        <div
                          className="bg-emerald-500"
                          style={{ width: `${(stats.presentes / stats.total) * 100}%` }}
                          title={`Presentes: ${stats.presentes}`}
                        />
                        <div
                          className="bg-amber-500"
                          style={{ width: `${(stats.tardanzas / stats.total) * 100}%` }}
                          title={`Tardanzas: ${stats.tardanzas}`}
                        />
                        <div
                          className="bg-teal-500"
                          style={{ width: `${(stats.justificados / stats.total) * 100}%` }}
                          title={`Justificados: ${stats.justificados}`}
                        />
                        <div
                          className="bg-red-500"
                          style={{ width: `${(stats.ausentes / stats.total) * 100}%` }}
                          title={`Ausentes: ${stats.ausentes}`}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <LegendDot color="bg-emerald-500" label="Presente" count={stats.presentes} />
                    <LegendDot color="bg-amber-500" label="Tardanza" count={stats.tardanzas} />
                    <LegendDot color="bg-teal-500" label="Justificado" count={stats.justificados} />
                    <LegendDot color="bg-red-500" label="Ausente" count={stats.ausentes} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calendar grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Calendario (30 días)</CardTitle>
              <CardDescription>
                {WEEKDAYS.map((d) => (
                  <span key={d} className="inline-block w-9 text-center text-xs uppercase text-muted-foreground mr-1">
                    {d}
                  </span>
                ))}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-md" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((d, idx) => {
                    const record = d.record
                    const isToday = isSameDay(d.date, new Date())
                    const style = record ? estadoStyle(record.estado) : null
                    return (
                      <div
                        key={idx}
                        title={
                          record
                            ? `${d.date.toLocaleDateString('es-VE')} · ${ESTADO_LABELS[record.estado] || record.estado}`
                            : `${d.date.toLocaleDateString('es-VE')} · Sin registro`
                        }
                        className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs border transition-colors ${
                          style
                            ? `${style.bg} ${style.border} ${style.text}`
                            : 'bg-muted/30 border-muted text-muted-foreground/60'
                        } ${isToday ? 'ring-2 ring-emerald-500 ring-offset-1 ring-offset-background' : ''}`}
                      >
                        <span className="font-semibold leading-none">{d.date.getDate()}</span>
                        {record && <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${style?.dot}`} />}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                Registros detallados
              </CardTitle>
              <CardDescription>
                {records.length} registro{records.length === 1 ? '' : 's'} en los últimos 30 días
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No hay registros de asistencia en el período</p>
                </div>
              ) : (
                <ScrollArea className="max-h-96 pr-4">
                  <ul className="space-y-2">
                    {records.map((r) => {
                      const style = estadoStyle(r.estado)
                      const Icon =
                        r.estado === 'presente'
                          ? CheckCircle2
                          : r.estado === 'ausente'
                          ? XCircle
                          : r.estado === 'tardanza'
                          ? AlertTriangle
                          : CheckCircle2
                      return (
                        <li
                          key={r.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${style.bg} ${style.border}`}
                        >
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium capitalize">
                              {new Date(r.fecha).toLocaleDateString('es-VE', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'short',
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {formatTime(r.fecha)} ·{' '}
                              <span className="capitalize">origen {r.origen}</span>
                            </p>
                          </div>
                          <Badge variant="outline" className={`${style.border} ${style.text} capitalize`}>
                            {ESTADO_LABELS[r.estado] || r.estado}
                          </Badge>
                        </li>
                      )
                    })}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: 'emerald' | 'red' | 'amber' | 'teal'
}) {
  const accents: Record<string, string> = {
    emerald: 'text-emerald-700 dark:text-emerald-300',
    red: 'text-red-700 dark:text-red-300',
    amber: 'text-amber-700 dark:text-amber-300',
    teal: 'text-teal-700 dark:text-teal-300',
  }
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className={accents[accent]}>{icon}</span>
          <span className="text-xs uppercase tracking-wide font-medium truncate">
            {label}
          </span>
        </div>
        <p className={`text-2xl font-bold mt-2 ${accents[accent]}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function LegendDot({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{count}</span>
    </span>
  )
}
