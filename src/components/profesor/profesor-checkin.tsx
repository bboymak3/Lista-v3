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
  LogIn,
  LogOut as LogOutIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Navigation,
  History,
  Crosshair,
} from 'lucide-react'

interface CheckinItem {
  id: string
  tipo: 'entrada' | 'salida'
  timestamp: string
  lat: number | null
  lng: number | null
}

interface CheckinStatus {
  hoy: {
    entrada: CheckinItem | null
    salida: CheckinItem | null
  }
  historial: CheckinItem[]
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

export function ProfesorCheckin() {
  const [data, setData] = useState<CheckinStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<'entrada' | 'salida' | null>(null)
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number; acc: number } | null>(
    null
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<CheckinStatus>('/profesor/checkin')
      setData(d)
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
            1: 'Permiso de ubicación denegado',
            2: 'Ubicación no disponible',
            3: 'Tiempo de espera agotado',
          }
          reject(new Error(msgs[err.code] || err.message))
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  }

  const handleCheckin = async (tipo: 'entrada' | 'salida') => {
    setActionLoading(tipo)
    let coords: { lat?: number; lng?: number } = {}
    try {
      const pos = await getPosition()
      coords = { lat: pos.lat, lng: pos.lng }
      setLastCoords({ lat: pos.lat, lng: pos.lng, acc: pos.acc })
    } catch (e: unknown) {
      // Sin GPS, registramos sin ubicación
      toast.warning('GPS no disponible: ' + (e as Error).message + '. Registrando sin ubicación.')
    }

    try {
      const res = await api.post<{ ok: boolean; yaExistente: boolean }>('/profesor/checkin', {
        tipo,
        lat: coords.lat,
        lng: coords.lng,
      })
      if (res.yaExistente) {
        toast.info(`Ya habías registrado ${tipo} hoy`)
      } else {
        toast.success(`${tipo === 'entrada' ? 'Entrada' : 'Salida'} registrada correctamente`)
      }
      await load()
    } catch (e: unknown) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  const entrada = data?.hoy?.entrada
  const salida = data?.hoy?.salida

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="w-6 h-6 text-emerald-600" />
          Mi Check-in GPS
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
          entrada
            ? 'border-emerald-300 dark:border-emerald-800'
            : 'border-amber-300 dark:border-amber-800'
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Estado de hoy</span>
            {entrada ? (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Activo
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500 text-amber-700">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Sin registro
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {!entrada && !salida && 'No has registrado entrada hoy'}
            {entrada && !salida && 'Entraste al plantel. Recuerda registrar tu salida al irte.'}
            {entrada && salida && 'Jornada completa: entrada y salida registradas.'}
            {!entrada && salida && 'Tienes salida pero no entrada. Contacta a dirección.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className={`rounded-lg border p-4 ${
                entrada
                  ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                  : 'border-muted bg-muted/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <LogIn className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span className="text-sm font-medium text-muted-foreground">Entrada</span>
              </div>
              {entrada ? (
                <>
                  <p className="text-3xl font-bold mt-2 text-emerald-700 dark:text-emerald-300">
                    {formatTime(entrada.timestamp)}
                  </p>
                  {entrada.lat != null && entrada.lng != null && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Crosshair className="w-3 h-3" />
                      {entrada.lat.toFixed(5)}, {entrada.lng.toFixed(5)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-lg mt-2 text-muted-foreground">No registrada</p>
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
                <>
                  <p className="text-3xl font-bold mt-2 text-orange-700 dark:text-orange-300">
                    {formatTime(salida.timestamp)}
                  </p>
                  {salida.lat != null && salida.lng != null && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Crosshair className="w-3 h-3" />
                      {salida.lat.toFixed(5)}, {salida.lng.toFixed(5)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-lg mt-2 text-muted-foreground">Pendiente</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Button
          onClick={() => handleCheckin('entrada')}
          disabled={actionLoading !== null || !!entrada}
          size="lg"
          className="h-auto py-8 flex flex-col items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
        >
          {actionLoading === 'entrada' ? (
            <Navigation className="w-8 h-8 animate-pulse" />
          ) : (
            <LogIn className="w-8 h-8" />
          )}
          <div>
            <div className="text-lg font-bold">
              {entrada ? 'Entrada registrada' : 'Registrar Entrada'}
            </div>
            <div className="text-xs text-emerald-100">
              {entrada ? formatTime(entrada.timestamp) : 'Marca tu llegada al plantel'}
            </div>
          </div>
        </Button>

        <Button
          onClick={() => handleCheckin('salida')}
          disabled={actionLoading !== null || !!salida || !entrada}
          size="lg"
          className="h-auto py-8 flex flex-col items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-60"
        >
          {actionLoading === 'salida' ? (
            <Navigation className="w-8 h-8 animate-pulse" />
          ) : (
            <LogOutIcon className="w-8 h-8" />
          )}
          <div>
            <div className="text-lg font-bold">
              {salida ? 'Salida registrada' : 'Registrar Salida'}
            </div>
            <div className="text-xs text-orange-100">
              {salida
                ? formatTime(salida.timestamp)
                : entrada
                ? 'Marca tu salida del plantel'
                : 'Requiere entrada primero'}
            </div>
          </div>
        </Button>
      </div>

      {/* Coordinates note */}
      {lastCoords && (
        <Card className="border-emerald-200 dark:border-emerald-900/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Crosshair className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Ubicación capturada</p>
                <p className="text-muted-foreground mt-1">
                  Lat: {lastCoords.lat.toFixed(6)}, Lng: {lastCoords.lng.toFixed(6)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Precisión aproximada: ±{lastCoords.acc.toFixed(0)} metros
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="w-4 h-4 text-muted-foreground" />
            Historial (últimos 7 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.historial || data.historial.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No hay registros recientes</p>
            </div>
          ) : (
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {data.historial.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 p-2.5 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      c.tipo === 'entrada'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400'
                    }`}
                  >
                    {c.tipo === 'entrada' ? (
                      <LogIn className="w-4 h-4" />
                    ) : (
                      <LogOutIcon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">
                      {c.tipo} · {formatDate(c.timestamp)}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatTime(c.timestamp)}</p>
                  </div>
                  {c.lat != null && c.lng != null && (
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
