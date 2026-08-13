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
  ClipboardCheck,
  MapPin,
  Newspaper,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  CalendarDays,
  LogIn,
  LogOut as LogOutIcon,
} from 'lucide-react'

interface SectionItem {
  id: string
  nombre: string
  grado: string
  turno: string
  plantel: string
  rol: string
  studentCount: number
}

interface CheckinStatus {
  hoy: {
    entrada: { id: string; timestamp: string; lat: number | null; lng: number | null } | null
    salida: { id: string; timestamp: string; lat: number | null; lng: number | null } | null
  }
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

export function ProfesorDashboard() {
  const user = useAuthStore((s) => s.user)
  const setActiveView = useViewStore((s) => s.setActiveView)
  const [sections, setSections] = useState<SectionItem[]>([])
  const [checkin, setCheckin] = useState<CheckinStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    Promise.all([
      api.get<{ sections: SectionItem[] }>('/profesor/sections'),
      api.get<CheckinStatus>('/profesor/checkin'),
    ])
      .then(([sec, chk]) => {
        if (!mounted) return
        setSections(sec.sections)
        setCheckin(chk)
      })
      .catch((e) => toast.error('Error al cargar datos: ' + e.message))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  const entrada = checkin?.hoy?.entrada
  const salida = checkin?.hoy?.salida
  const totalStudents = sections.reduce((sum, s) => sum + s.studentCount, 0)

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <Card className="overflow-hidden border-emerald-200 dark:border-emerald-900/50">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-emerald-50 text-sm capitalize">{formatFecha()}</p>
              <h2 className="text-2xl font-bold mt-1">
                ¡Hola, {user?.nombre}! 👋
              </h2>
              <p className="text-emerald-50 text-sm mt-1">
                {sections.length} secciones asignadas · {totalStudents} estudiantes
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

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
          Acciones rápidas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button
            onClick={() => setActiveView('profesor-attendance')}
            className="h-auto py-5 flex flex-col items-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <ClipboardCheck className="w-6 h-6" />
            <div className="text-left">
              <div className="font-semibold">Pasar Asistencia</div>
              <div className="text-xs text-emerald-100">Registrar asistencia diaria</div>
            </div>
          </Button>

          <Button
            onClick={() => setActiveView('profesor-checkin')}
            variant={entrada ? 'secondary' : 'default'}
            className={`h-auto py-5 flex flex-col items-start gap-2 ${
              entrada
                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-teal-600 hover:bg-teal-700 text-white'
            }`}
          >
            {entrada ? <CheckCircle2 className="w-6 h-6" /> : <MapPin className="w-6 h-6" />}
            <div className="text-left">
              <div className="font-semibold">
                {entrada ? 'Entrada registrada' : 'Registrar Entrada'}
              </div>
              <div className="text-xs opacity-80">
                {entrada ? formatTime(entrada.timestamp) : 'Check-in GPS'}
              </div>
            </div>
          </Button>

          <Button
            onClick={() => setActiveView('profesor-feed')}
            variant="outline"
            className="h-auto py-5 flex flex-col items-start gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
          >
            <Newspaper className="w-6 h-6" />
            <div className="text-left">
              <div className="font-semibold">Publicar Aviso</div>
              <div className="text-xs opacity-80">Enviar aviso a representantes</div>
            </div>
          </Button>
        </div>
      </div>

      {/* Checkin status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            Estado de hoy
          </CardTitle>
          <CardDescription>Tu registro de entrada y salida de hoy</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                className={`rounded-lg border p-4 ${
                  entrada
                    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                    : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <LogIn className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-muted-foreground">Entrada</span>
                </div>
                {entrada ? (
                  <p className="text-2xl font-bold mt-2 text-emerald-700 dark:text-emerald-300">
                    {formatTime(entrada.timestamp)}
                  </p>
                ) : (
                  <p className="text-lg mt-2 text-amber-700 dark:text-amber-400">
                    No registrada
                  </p>
                )}
              </div>

              <div
                className={`rounded-lg border p-4 ${
                  salida
                    ? 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30'
                    : 'border-muted bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <LogOutIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-sm font-medium text-muted-foreground">Salida</span>
                </div>
                {salida ? (
                  <p className="text-2xl font-bold mt-2 text-orange-700 dark:text-orange-300">
                    {formatTime(salida.timestamp)}
                  </p>
                ) : (
                  <p className="text-lg mt-2 text-muted-foreground">Pendiente</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            Mis secciones
          </CardTitle>
          <CardDescription>Secciones donde eres tutor o profesor</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : sections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No tienes secciones asignadas</p>
            </div>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {sections.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                        {s.nombre}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.plantel}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        Turno {s.turno} · {s.studentCount} estudiantes
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={s.rol === 'tutor' ? 'default' : 'secondary'}
                    className={
                      s.rol === 'tutor'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : ''
                    }
                  >
                    {s.rol}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
