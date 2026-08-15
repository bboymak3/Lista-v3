'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api-client'
import { useRepresentanteStore } from '@/stores/representante-store'
import { ChildSelector } from './child-selector'
import { MapView } from './map-view'
import {
  formatRelative,
  formatTime,
  formatDistance,
  haversineM,
} from './utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  MapPin,
  RefreshCw,
  Clock,
  Crosshair,
  Navigation,
  AlertTriangle,
  WifiOff,
  Users,
} from 'lucide-react'

interface LocationPing {
  id: string
  lat: number
  lng: number
  precision: number | null
  timestamp: string
}

interface LocationResponse {
  location: LocationPing | null
  stale?: boolean
}

function safeDate(ts: string): Date {
  const d = new Date(ts)
  return isNaN(d.getTime()) ? new Date(0) : d
}

export function ChildLocationMap() {
  const children = useRepresentanteStore((s) => s.children)
  const selectedChildId = useRepresentanteStore((s) => s.selectedChildId)
  const fetchChildren = useRepresentanteStore((s) => s.fetchChildren)
  const loadingChildren = useRepresentanteStore((s) => s.loading)

  const [location, setLocation] = useState<LocationPing | null>(null)
  const [stale, setStale] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastTimestampRef = useRef<string | null>(null)
  const stoppedRef = useRef(false)
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchChildren()
  }, [fetchChildren])

  const selectedChild = children.find((c) => c.id === selectedChildId) || null

  // Cargar la última ubicación sin esperar — primera carga inmediata.
  const loadInitial = useCallback(
    async (estudianteId: string) => {
      setLoadingInitial(true)
      setError(null)
      try {
        const data = await apiFetch<LocationResponse>(
          `/representante/location?estudianteId=${estudianteId}`
        )
        if (stoppedRef.current) return
        setLocation(data.location)
        setStale(Boolean(data.stale))
        if (data.location) {
          lastTimestampRef.current = data.location.timestamp
        }
      } catch (e: unknown) {
        if (stoppedRef.current) return
        setError((e as Error).message)
      } finally {
        if (!stoppedRef.current) setLoadingInitial(false)
      }
    },
    []
  )

  // Long polling loop — espera hasta 25s por un ping más nuevo.
  const startLongPoll = useCallback(
    async (estudianteId: string) => {
      if (stoppedRef.current) return
      setPolling(true)
      try {
        while (!stoppedRef.current) {
          const url = `/representante/location?estudianteId=${estudianteId}&wait=true${
            lastTimestampRef.current
              ? `&lastTimestamp=${encodeURIComponent(lastTimestampRef.current)}`
              : ''
          }`
          const data = await apiFetch<LocationResponse>(url)
          if (stoppedRef.current) break
          if (data.location) {
            // Solo actualizar si es más nuevo que el último mostrado
            const current = lastTimestampRef.current
              ? safeDate(lastTimestampRef.current).getTime()
              : 0
            if (safeDate(data.location.timestamp).getTime() >= current) {
              setLocation(data.location)
              setStale(Boolean(data.stale))
              lastTimestampRef.current = data.location.timestamp
            }
          } else if (data.stale) {
            setStale(true)
          }
          // Pequeña pausa antes de re-abrir la conexión
          await new Promise((r) => setTimeout(r, 500))
        }
      } catch {
        // En caso de error (red, 401, etc.), pausar y reintentar más tarde
        if (!stoppedRef.current) {
          await new Promise((r) => setTimeout(r, 5000))
          if (!stoppedRef.current) startLongPoll(estudianteId)
        }
      } finally {
        if (!stoppedRef.current) setPolling(false)
      }
    },
    []
  )

  // Inicializar/limpiar polling cuando cambia el hijo seleccionado
  useEffect(() => {
    if (!selectedChild) return
    stoppedRef.current = false
    lastTimestampRef.current = null
    setLocation(null)
    setStale(false)

    loadInitial(selectedChild.id).then(() => {
      if (!stoppedRef.current) startLongPoll(selectedChild.id)
    })

    // Fallback: refresco cada 15s por si el long polling se atasca
    fallbackTimerRef.current = setInterval(() => {
      if (stoppedRef.current) return
      loadInitial(selectedChild.id)
    }, 15000)

    return () => {
      stoppedRef.current = true
      if (fallbackTimerRef.current) clearInterval(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }, [selectedChild?.id, loadInitial, startLongPoll])

  const handleManualRefresh = async () => {
    if (!selectedChild) return
    await loadInitial(selectedChild.id)
    toast.success('Ubicación actualizada')
  }

  const distanceM = location && selectedChild
    ? haversineM(
        selectedChild.section.plantel.lat,
        selectedChild.section.plantel.lng,
        location.lat,
        location.lng
      )
    : null

  const insideGeofence = distanceM != null && selectedChild
    ? distanceM <= selectedChild.section.plantel.radioM
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="w-6 h-6 text-emerald-600" />
          Ubicación en vivo
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString('es-VE', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
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
          {/* Mapa */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-emerald-600" />
                  Mapa de ubicación
                </span>
                <div className="flex items-center gap-2">
                  {polling ? (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                      En vivo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <WifiOff className="w-3 h-3 mr-1" />
                      Sin conexión
                    </Badge>
                  )}
                </div>
              </CardTitle>
              <CardDescription>
                Plantel <strong>{selectedChild.section.plantel.nombre}</strong> ·
                Radio de geocerca {selectedChild.section.plantel.radioM} m
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingInitial ? (
                <Skeleton className="h-[300px] w-full rounded-xl" />
              ) : location ? (
                <MapView
                  plantel={{
                    lat: selectedChild.section.plantel.lat,
                    lng: selectedChild.section.plantel.lng,
                    radioM: selectedChild.section.plantel.radioM,
                    nombre: selectedChild.section.plantel.nombre,
                  }}
                  student={{
                    lat: location.lat,
                    lng: location.lng,
                    timestamp: location.timestamp,
                    precision: location.precision,
                  }}
                  stale={stale}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground border rounded-xl bg-muted/20">
                  <MapPin className="w-12 h-12 mb-3 opacity-40" />
                  <p className="font-medium">Sin ubicación disponible</p>
                  <p className="text-sm mt-1">
                    Tu hijo/a aún no ha reportado su ubicación.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detalles de ubicación */}
          {location && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wide font-medium">
                      Última actualización
                    </span>
                  </div>
                  <p className="text-lg font-bold mt-2">
                    {formatTime(location.timestamp)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatRelative(location.timestamp)}
                    {stale && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                        (sin actualizar)
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Navigation className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wide font-medium">
                      Distancia al plantel
                    </span>
                  </div>
                  <p className="text-lg font-bold mt-2">
                    {distanceM != null ? formatDistance(distanceM) : '—'}
                  </p>
                  {insideGeofence != null && (
                    <Badge
                      variant="outline"
                      className={
                        insideGeofence
                          ? 'mt-1 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400'
                          : 'mt-1 border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400'
                      }
                    >
                      {insideGeofence
                        ? 'Dentro del plantel'
                        : 'Fuera del plantel'}
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Crosshair className="w-4 h-4" />
                    <span className="text-xs uppercase tracking-wide font-medium">
                      Precisión GPS
                    </span>
                  </div>
                  <p className="text-lg font-bold mt-2">
                    {location.precision != null
                      ? `±${Math.round(location.precision)} m`
                      : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Aviso de datos sin actualizar */}
          {stale && location && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  Ubicación desactualizada
                </p>
                <p className="text-amber-700 dark:text-amber-400/80 mt-0.5">
                  No hemos recibido actualizaciones recientes del dispositivo de{' '}
                  {selectedChild.nombre}. La posición mostrada puede no ser actual.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
            </div>
          )}

          {/* Botón actualizar */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={handleManualRefresh}
              disabled={loadingInitial}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingInitial ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
