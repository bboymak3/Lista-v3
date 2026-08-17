'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { useViewStore } from '@/stores/view-store'
import { toast } from 'sonner'
import {
  QrCode,
  MapPin,
  Newspaper,
  CheckCircle2,
  Clock,
  Bell,
  CalendarDays,
  AlertTriangle,
} from 'lucide-react'

interface AlumnoProfile {
  id: string
  codigoUnico: string
  cedulaEscolar: string | null
  nombre: string
  apellido: string
  qrCode: string
  section: {
    id: string
    nombre: string
    grado: string
    turno: string
    plantel: {
      id: string
      nombre: string
      radioM: number
      periodoActual: string
    }
  }
}

interface AsistenciaHoy {
  id: string
  estado: string
  origen: string
  fecha: string
  lat: number | null
  lng: number | null
  sessionId: string | null
}

interface CheckinStatus {
  plantel: { nombre: string; radioM: number }
  lastPing: { lat: number; lng: number; timestamp: string } | null
}

interface NotificationCount {
  count: number
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return '--:--'
  }
}

function formatFecha(): string {
  return new Date().toLocaleDateString('es-VE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function capitalizeTurno(turno: string): string {
  const map: Record<string, string> = {
    manana: 'Mañana',
    tarde: 'Tarde',
    nocturno: 'Nocturno',
  }
  return map[turno] || turno
}

export function AlumnoDashboard() {
  const user = useAuthStore((s) => s.user)
  const setActiveView = useViewStore((s) => s.setActiveView)
  const [profile, setProfile] = useState<AlumnoProfile | null>(null)
  const [checkin, setCheckin] = useState<CheckinStatus | null>(null)
  const [notifCount, setNotifCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([
      api.get<AlumnoProfile>('/alumno/profile'),
      api.get<CheckinStatus>('/alumno/checkin'),
      api
        .get<{ notifications: { leida: boolean }[]; noLeidas: number }>('/notifications')
        .then((d) => ({ count: d.noLeidas }))
        .catch(() => ({ count: 0 })),
    ])
      .then(([p, c, n]) => {
        if (!mounted) return
        setProfile(p)
        setCheckin(c)
        setNotifCount((n as NotificationCount).count)
      })
      .catch((e) => toast.error('Error al cargar datos: ' + e.message))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  const ubicacionReportada = !!checkin?.lastPing

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <Card className="overflow-hidden border-emerald-200 dark:border-emerald-900/50">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-emerald-50 text-sm capitalize">{formatFecha()}</p>
              <h2 className="text-2xl font-bold mt-1">
                ¡Hola, {profile?.nombre || user?.nombre}! 👋
              </h2>
              <p className="text-emerald-50 text-sm mt-1">
                {profile
                  ? `Sección ${profile.section.nombre} · ${capitalizeTurno(profile.section.turno)}`
                  : 'Cargando sección…'}
              </p>
              {profile?.section.plantel && (
                <p className="text-emerald-50/90 text-xs mt-0.5">
                  {profile.section.plantel.nombre}
                </p>
              )}
            </div>
            <Avatar className="w-14 h-14 border-2 border-white/30">
              <AvatarFallback className="bg-white/20 text-white text-lg font-bold">
                {`${profile?.nombre?.[0] || user?.nombre?.[0] || ''}${
                  profile?.apellido?.[0] || user?.apellido?.[0] || ''
                }`.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </Card>

      {/* Today's status card */}
      <Card
        className={
          ubicacionReportada
            ? 'border-emerald-300 dark:border-emerald-800'
            : 'border-amber-300 dark:border-amber-800'
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Mi ubicación
            </span>
            {ubicacionReportada ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Reportada
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500 text-amber-700">
                Sin reportar
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {ubicacionReportada
              ? `Última ubicación: ${formatTime(checkin!.lastPing!.timestamp)}`
              : 'Aún no has reportado tu ubicación hoy'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : ubicacionReportada ? (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-emerald-700 dark:text-emerald-300">
                  ¡Bienvenido al plantel!
                </p>
                <p className="text-xs text-muted-foreground">
                  Tu asistencia fue registrada vía GPS.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-amber-700 dark:text-amber-300">
                  Reporta tu ubicación cuando estés en el plantel
                </p>
                <p className="text-xs text-muted-foreground">
                  Acércate al plantel y reporta tu ubicación.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick action */}
      {!ubicacionReportada && (
        <Button
          onClick={() => setActiveView('alumno-checkin')}
          size="lg"
          className="w-full h-auto py-6 flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <MapPin className="w-6 h-6" />
          <div className="text-left">
            <div className="text-lg font-bold">Reportar Ubicación</div>
            <div className="text-xs text-emerald-100">Comparte tu ubicación con tu representante</div>
          </div>
        </Button>
      )}

      {/* Quick actions grid */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Acciones rápidas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button
            onClick={() => setActiveView('alumno-carnet')}
            variant="outline"
            className="h-auto py-5 flex flex-col items-start gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
          >
            <QrCode className="w-6 h-6" />
            <div className="text-left">
              <div className="font-semibold">Mi Carnet</div>
              <div className="text-xs opacity-80">Muestra tu QR</div>
            </div>
          </Button>

          <Button
            onClick={() => setActiveView('alumno-checkin')}
            variant={ubicacionReportada ? 'secondary' : 'default'}
            className={`h-auto py-5 flex flex-col items-start gap-2 ${
              ubicacionReportada
                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-teal-600 hover:bg-teal-700 text-white'
            }`}
          >
            <MapPin className="w-6 h-6" />
            <div className="text-left">
              <div className="font-semibold">
                {ubicacionReportada ? 'Reportada' : 'Check-in'}
              </div>
              <div className="text-xs opacity-80">
                {ubicacionReportada ? formatTime(checkin!.lastPing!.timestamp) : 'Reportar ubicación'}
              </div>
            </div>
          </Button>

          <Button
            onClick={() => setActiveView('alumno-feed')}
            variant="outline"
            className="h-auto py-5 flex flex-col items-start gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
          >
            <Newspaper className="w-6 h-6" />
            <div className="text-left">
              <div className="font-semibold">Noticias</div>
              <div className="text-xs opacity-80">Avisos del plantel</div>
            </div>
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <Bell className="w-3.5 h-3.5" />
              <span>Avisos</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {loading ? <Skeleton className="h-7 w-12" /> : notifCount}
            </p>
            <p className="text-xs text-muted-foreground">sin leer</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <Clock className="w-3.5 h-3.5" />
              <span>Hoy</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {loading ? (
                <Skeleton className="h-7 w-20" />
              ) : ubicacionReportada ? (
                formatTime(checkin!.lastPing!.timestamp)
              ) : (
                '—'
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {ubicacionReportada ? 'reportada' : 'sin reportar'}
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Geocerca</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              {loading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                checkin?.plantel?.radioM + 'm'
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {checkin?.plantel?.nombre || '—'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
