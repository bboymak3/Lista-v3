'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  History,
  Crosshair,
  Clock,
  LogIn,
  Satellite,
  Ruler,
} from 'lucide-react'

interface AsistenciaHoy {
  id: string
  estado: string
  origen: string
  lat: number | null
  lng: number | null
  fecha: string
  sessionId: string | null
}

interface PlantelData {
  id: string
  nombre: string
  lat: number
  lng: number
  radioM: number
}

interface CheckinStatus {
  hoy: AsistenciaHoy | null
  plantel: PlantelData
}

interface AttendanceRecord {
  id: string
  estado: string
  origen: string
  observacion: string | null
  fecha: string
  lat: number | null
  lng: number | null
  session: { id: string; estado: string; fecha: string } | null
}

interface FueraRangoResponse {
  error: string
  distancia: number
  radioPermitido: number
  plantelNombre?: string
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-VE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  } catch {
    return ''
  }
}

const estadoConfig: Record<
  string,
  { label: string; badge: string; icon: React.ReactNode }
> = {
  presente: {
    label: 'Presente',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  ausente: {
    label: 'Ausente',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  tardanza: {
    label: 'Tardanza',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    icon: <Clock className="w-4 h-4" />,
  },
  justificado: {
    label: 'Justificado',
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
}

export function AlumnoCheckin() {
  const [data, setData] = useState<CheckinStatus | null>(null)
  const [history, setHistory] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [lastCoords, setLastCoords] = useState<{
    lat: number
    lng: number
    acc: number
  } | null>(null)
  const [fueraRango, setFueraRango] = useState<FueraRangoResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [status, hist] = await Promise.all([
        api.get<CheckinStatus>('/alumno/checkin'),
        api.get<{ historial: AttendanceRecord[] }>('/alumno/attendance'),
      ])
      setData(status)
      setHistory(hist.historial.slice(0, 7))
    } catch (e: unknown) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const getPosition = (): Promise<{ lat: number; lng: number; acc: number }> => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocalización no disponible en este dispositivo'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            acc: pos.coords.accuracy,
          })
        },
        (err) => {
          const msgs: Record<number, string> = {
            1: 'Permiso de ubicación denegado. Activa el GPS en tu navegador.',
            2: 'Ubicación no disponible. Verifica que el GPS esté activado.',
            3: 'Tiempo de espera agotado. Intenta de nuevo.',
          }
          reject(new Error(msgs[err.code] || err.message))
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      )
    })
  }

  const handleCheckin = async () => {
    setActionLoading(true)
    setFueraRango(null)
    let coords: { lat: number; lng: number; acc: number } | null = null

    try {
      coords = await getPosition()
      setLastCoords(coords)
    } catch (e: unknown) {
      toast.error('No se pudo obtener tu ubicación: ' + (e as Error).message)
      setActionLoading(false)
      return
    }

    // Hacemos fetch directo para poder leer el body del 403
    try {
      const token = (await import('@/stores/auth-store')).useAuthStore.getState().token
      const res = await fetch('/api/alumno/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lat: coords.lat, lng: coords.lng }),
      })

      const data2 = await res.json().catch(() => ({}))

      if (res.status === 403 && data2.error === 'Fuera del rango del plantel') {
        setFueraRango({
          error: data2.error,
          distancia: data2.distancia,
          radioPermitido: data2.radioPermitido,
          plantelNombre: data2.plantelNombre,
        })
        toast.error(
          `Estás a ${data2.distancia}m del plantel (permitido: ${data2.radioPermitido}m)`
        )
      } else if (!res.ok) {
        toast.error(data2.error || 'Error al registrar check-in')
      } else {
        if (data2.yaExistente) {
          toast.info('Ya tenías un check-in registrado hoy')
        } else {
          toast.success('¡Check-in registrado: Presente! 🎉')
        }
        await load()
      }
    } catch (e: unknown) {
      toast.error('Error de red: ' + (e as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const hoy = data?.hoy
  const presente = hoy?.estado === 'presente'
  const plantel = data?.plantel

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="w-6 h-6 text-emerald-600" />
          Mi Check-in
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString('es-VE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Status Card */}
      <Card
        className={
          presente
            ? 'border-emerald-300 dark:border-emerald-800'
            : 'border-amber-300 dark:border-amber-800'
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Estado de hoy</span>
            {presente ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Presente
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500 text-amber-700">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Sin registro
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {presente
              ? `Registraste tu entrada a las ${formatTime(hoy!.fecha)}`
              : 'No has registrado entrada hoy'}
            {plantel && ` · Plantel: ${plantel.nombre}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-20 w-full" />
          ) : presente ? (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  Presente desde las {formatTime(hoy!.fecha)}
                </p>
                {hoy!.lat != null && hoy!.lng != null && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Crosshair className="w-3 h-3" />
                    {hoy!.lat.toFixed(5)}, {hoy!.lng.toFixed(5)} ·{' '}
                    <span className="capitalize">origen: {hoy!.origen.replace('_', ' ')}</span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0">
                <Clock className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                  No has registrado entrada hoy
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Acércate al plantel y presiona el botón para registrar tu llegada.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Big Action Button */}
      <Button
        onClick={handleCheckin}
        disabled={actionLoading || presente}
        size="lg"
        className="w-full h-auto py-8 flex flex-col items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
      >
        {actionLoading ? (
          <Navigation className="w-10 h-10 animate-pulse" />
        ) : (
          <LogIn className="w-10 h-10" />
        )}
        <div>
          <div className="text-lg font-bold">
            {presente
              ? 'Entrada registrada'
              : actionLoading
              ? 'Obteniendo ubicación…'
              : 'Registrar Entrada'}
          </div>
          <div className="text-xs text-emerald-100">
            {presente
              ? formatTime(hoy!.fecha)
              : 'Usaremos tu GPS para verificar que estás en el plantel'}
          </div>
        </div>
      </Button>

      {/* Coordinates / GPS info */}
      {lastCoords && (
        <Card className="border-emerald-200 dark:border-emerald-900/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Satellite className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Última ubicación capturada</p>
                <p className="text-muted-foreground mt-1">
                  Lat: {lastCoords.lat.toFixed(6)}, Lng: {lastCoords.lng.toFixed(6)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Ruler className="w-3 h-3" />
                  Precisión: ±{lastCoords.acc.toFixed(0)} metros
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Out of range visualization */}
      {fueraRango && (
        <Card className="border-red-300 dark:border-red-900/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Fuera del rango del plantel
            </CardTitle>
            <CardDescription>
              {fueraRango.plantelNombre
                ? `Estás demasiado lejos de "${fueraRango.plantelNombre}".`
                : 'Estás demasiado lejos del plantel.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Map-like visual */}
            <div className="relative h-44 rounded-lg overflow-hidden border bg-muted/30">
              <div className="absolute inset-0 grid grid-cols-8 grid-rows-6 opacity-30">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div key={i} className="border border-emerald-200 dark:border-emerald-900" />
                ))}
              </div>
              {/* Plantel en el centro */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div className="relative">
                  <div
                    className="rounded-full border-2 border-emerald-500/60 bg-emerald-500/10"
                    style={{
                      width: `${Math.min(140, (fueraRango.radioPermitido / Math.max(fueraRango.distancia, fueraRango.radioPermitido)) * 140)}px`,
                      height: `${Math.min(140, (fueraRango.radioPermitido / Math.max(fueraRango.distancia, fueraRango.radioPermitido)) * 140)}px`,
                    }}
                  />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                    <MapPin className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 font-medium">
                  Plantel · {fueraRango.radioPermitido}m
                </span>
              </div>
              {/* Tu ubicación (fuera) */}
              <div
                className="absolute top-1/2 right-4 -translate-y-1/2 flex flex-col items-center"
                style={{ marginTop: '-30px' }}
              >
                <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center animate-pulse">
                  <Crosshair className="w-3 h-3" />
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 font-medium">
                  Tú · {fueraRango.distancia}m
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-center">
                <p className="text-xs text-muted-foreground uppercase">Tu distancia</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {fueraRango.distancia}m
                </p>
              </div>
              <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                <p className="text-xs text-muted-foreground uppercase">Permitido</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {fueraRango.radioPermitido}m
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Acércate al plantel para poder registrar tu entrada.
            </p>
          </CardContent>
        </Card>
      )}

      {/* History 7 days */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4 text-muted-foreground" />
            Últimos 7 días
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No hay registros recientes</p>
            </div>
          ) : (
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {history.map((r) => {
                const cfg = estadoConfig[r.estado] || estadoConfig.presente
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 p-2.5 rounded-md hover:bg-accent/50 transition-colors"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.badge}`}
                    >
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize">
                        {cfg.label} · {formatDate(r.fecha)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(r.fecha)} ·{' '}
                        <span className="capitalize">
                          {r.origen.replace('_', ' ')}
                        </span>
                      </p>
                    </div>
                    {r.lat != null && r.lng != null && (
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
