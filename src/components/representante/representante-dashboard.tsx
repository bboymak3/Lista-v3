'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { useViewStore } from '@/stores/view-store'
import { useRepresentanteStore } from '@/stores/representante-store'
import { ChildSelector } from './child-selector'
import { RepresentanteStudentPhoto } from './representante-student-photo'
import {
  ESTADO_LABELS,
  estadoStyle,
  formatRelative,
  formatTime,
  isToday,
} from './utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  MapPin,
  ClipboardCheck,
  Newspaper,
  Bell,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  CalendarDays,
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

interface LocationPing {
  id: string
  lat: number
  lng: number
  precision: number | null
  timestamp: string
}

interface NotificationCount {
  noLeidas: number
}

function todayStatusCard(estado: string | null) {
  if (!estado)
    return {
      icon: HelpCircle,
      label: 'No registrado',
      desc: 'No hay asistencia registrada para hoy',
      color: 'text-muted-foreground',
      bg: 'bg-muted/40',
      border: 'border-muted',
    }
  switch (estado) {
    case 'presente':
      return {
        icon: CheckCircle2,
        label: ESTADO_LABELS.presente,
        desc: 'Tu hijo/a asistió hoy',
        color: 'text-emerald-700 dark:text-emerald-300',
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-300 dark:border-emerald-800',
      }
    case 'ausente':
      return {
        icon: XCircle,
        label: ESTADO_LABELS.ausente,
        desc: 'Tu hijo/a no asistió hoy',
        color: 'text-red-700 dark:text-red-300',
        bg: 'bg-red-50 dark:bg-red-950/30',
        border: 'border-red-300 dark:border-red-800',
      }
    case 'tardanza':
      return {
        icon: AlertTriangle,
        label: ESTADO_LABELS.tardanza,
        desc: 'Llegó tarde a clases',
        color: 'text-amber-700 dark:text-amber-300',
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        border: 'border-amber-300 dark:border-amber-800',
      }
    case 'justificado':
      return {
        icon: CheckCircle2,
        label: ESTADO_LABELS.justificado,
        desc: 'Ausencia justificada',
        color: 'text-teal-700 dark:text-teal-300',
        bg: 'bg-teal-50 dark:bg-teal-950/30',
        border: 'border-teal-300 dark:border-teal-800',
      }
    default:
      return {
        icon: HelpCircle,
        label: estado,
        desc: '',
        color: 'text-muted-foreground',
        bg: 'bg-muted/40',
        border: 'border-muted',
      }
  }
}

export function RepresentanteDashboard() {
  const user = useAuthStore((s) => s.user)
  const setActiveView = useViewStore((s) => s.setActiveView)
  const children = useRepresentanteStore((s) => s.children)
  const selectedChildId = useRepresentanteStore((s) => s.selectedChildId)
  const fetchChildren = useRepresentanteStore((s) => s.fetchChildren)
  const loadingChildren = useRepresentanteStore((s) => s.loading)

  const [attendance, setAttendance] = useState<AttendanceRecord[] | null>(null)
  const [location, setLocation] = useState<LocationPing | null>(null)
  const [notifCount, setNotifCount] = useState<number>(0)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    fetchChildren()
  }, [fetchChildren])

  const selectedChild = children.find((c) => c.id === selectedChildId) || null

  const loadDetail = useCallback(async (childId: string) => {
    setLoadingDetail(true)
    try {
      const [att, loc, notif] = await Promise.all([
        api
          .get<{ attendance: AttendanceRecord[] }>(
            `/representante/attendance?estudianteId=${childId}`
          )
          .catch(() => ({ attendance: [] as AttendanceRecord[] })),
        api
          .get<{ location: LocationPing | null }>(
            `/representante/location?estudianteId=${childId}`
          )
          .catch(() => ({ location: null as LocationPing | null })),
        api
          .get<{ noLeidas: number }>(`/representante/notifications`)
          .catch(() => ({ noLeidas: 0 })),
      ])
      setAttendance(att.attendance || [])
      setLocation(loc.location || null)
      setNotifCount(notif.noLeidas || 0)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedChild) return
    let active = true
    loadDetail(selectedChild.id).catch(() => {
      // Errores ya manejados con .catch internos
    })
    return () => {
      active = false
    }
  }, [selectedChild?.id, loadDetail])

  const todayAttendance =
    attendance?.find((a) => isToday(a.fecha)) || null
  const todayStatus = todayStatusCard(todayAttendance?.estado || null)
  const StatusIcon = todayStatus.icon

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <Card className="overflow-hidden border-emerald-200 dark:border-emerald-900/50">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-emerald-50 text-sm capitalize">
                {new Date().toLocaleDateString('es-VE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              <h2 className="text-2xl font-bold mt-1">
                ¡Hola, {user?.nombre}! 👋
              </h2>
              <p className="text-emerald-50 text-sm mt-1">
                {children.length} hijo{children.length === 1 ? '' : 's'} ·{' '}
                {children.length > 0
                  ? 'Siguiendo su asistencia y ubicación'
                  : 'Sin hijos registrados'}
              </p>
            </div>
            <Avatar className="w-14 h-14 border-2 border-white/30">
              <AvatarFallback className="bg-white/20 text-white text-lg font-bold">
                {`${user?.nombre?.[0] || ''}${user?.apellido?.[0] || ''}`.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </Card>

      {/* Child selector */}
      <ChildSelector />

      {/* No children state */}
      {!loadingChildren && children.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No tienes hijos asociados</p>
            <p className="text-sm mt-1">
              Contacta a dirección para que asocien a tu hijo/a a tu cuenta.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {(loadingChildren || loadingDetail) && selectedChild === null && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {selectedChild && (
        <>
          {/* Today status */}
          <Card className={todayStatus.border}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="w-4 h-4 text-emerald-600" />
                Asistencia de hoy
              </CardTitle>
              <CardDescription>
                {selectedChild.nombre} {selectedChild.apellido} ·{' '}
                {selectedChild.section.nombre}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDetail ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div
                  className={`rounded-lg border p-4 flex items-center gap-4 ${todayStatus.bg} ${todayStatus.border}`}
                >
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${todayStatus.bg} ${todayStatus.border} border-2`}
                  >
                    <StatusIcon className={`w-7 h-7 ${todayStatus.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-2xl font-bold ${todayStatus.color}`}>
                      {todayStatus.label}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {todayStatus.desc}
                    </p>
                    {todayAttendance && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Registrado a las{' '}
                        {formatTime(todayAttendance.fecha)} · origen{' '}
                        <span className="capitalize">
                          {todayAttendance.origen}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Last known location */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Última ubicación conocida
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDetail ? (
                <Skeleton className="h-16 w-full" />
              ) : location ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className="border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                    >
                      <MapPin className="w-3 h-3 mr-1" />
                      {formatRelative(location.timestamp)}
                    </Badge>
                    {location.precision != null && (
                      <span className="text-xs text-muted-foreground">
                        Precisión ±{Math.round(location.precision)} m
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 opacity-50" />
                  Sin ubicación disponible
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              Acciones rápidas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Button
                onClick={() => setActiveView('representante-location')}
                className="h-auto py-5 flex flex-col items-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <MapPin className="w-6 h-6" />
                <div className="text-left">
                  <div className="font-semibold">Ver Ubicación</div>
                  <div className="text-xs text-emerald-100">
                    Mapa en tiempo real
                  </div>
                </div>
              </Button>

              <Button
                onClick={() => setActiveView('representante-attendance')}
                variant="outline"
                className="h-auto py-5 flex flex-col items-start gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
              >
                <ClipboardCheck className="w-6 h-6" />
                <div className="text-left">
                  <div className="font-semibold">Ver Asistencia</div>
                  <div className="text-xs opacity-80">Historial 30 días</div>
                </div>
              </Button>

              <Button
                onClick={() => setActiveView('representante-feed')}
                variant="outline"
                className="h-auto py-5 flex flex-col items-start gap-2 border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-300 dark:hover:bg-teal-950/30"
              >
                <Newspaper className="w-6 h-6" />
                <div className="text-left">
                  <div className="font-semibold">Ver Noticias</div>
                  <div className="text-xs opacity-80">Avisos de la sección</div>
                </div>
              </Button>
            </div>
          </div>

          {/* Foto del alumno */}
          <RepresentanteStudentPhoto
            estudianteId={selectedChild.id}
            fotoKey={selectedChild.fotoKey}
            nombre={selectedChild.nombre}
            apellido={selectedChild.apellido}
          />

          {/* Notifications badge */}
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setActiveView('representante-notifications')}>
            <CardContent className="py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  {notifCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {notifCount > 99 ? '99+' : notifCount}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">Avisos y notificaciones</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {notifCount > 0
                      ? `${notifCount} sin leer`
                      : 'No tienes avisos nuevos'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveView('representante-notifications')
                }}
              >
                Ver todos
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
