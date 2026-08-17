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
  Crosshair,
  Clock,
  Satellite,
  Ruler,
  Info,
} from 'lucide-react'

interface PlantelData {
  nombre: string
  lat: number
  lng: number
  radioM: number
}

interface LastPing {
  lat: number
  lng: number
  timestamp: string
}

interface CheckinStatus {
  plantel: PlantelData
  lastPing: LastPing | null
}

interface CheckinResponse {
  ok: boolean
  message: string
  dentroGeocerca: boolean
  distancia: number
  radioPermitido: number
  plantelNombre: string
  timestamp: string
}

export function AlumnoCheckin() {
  const [status, setStatus] = useState<CheckinStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [reporting, setReporting] = useState(false)
  const [lastReport, setLastReport] = useState<CheckinResponse | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.get<CheckinStatus>('/alumno/checkin')
      setStatus(data)
    } catch (err: any) {
      toast.error(err.message || 'Error al cargar estado')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleReportLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Tu dispositivo no soporta geolocalización')
      return
    }

    setReporting(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords
        try {
          const data = await api.post<CheckinResponse>('/alumno/checkin', { lat, lng })
          setLastReport(data)
          if (data.dentroGeocerca) {
            toast.success('Ubicación reportada — estás dentro del plantel')
          } else {
            toast.warning(`Estás a ${data.distancia}m del plantel`)
          }
          loadStatus()
        } catch (err: any) {
          toast.error(err.message || 'Error al reportar ubicación')
        } finally {
          setReporting(false)
        }
      },
      (error) => {
        setReporting(false)
        if (error.code === error.PERMISSION_DENIED) {
          toast.error('Permiso de ubicación denegado. Actívalo en tu navegador.')
        } else if (error.code === error.TIMEOUT) {
          toast.error('Tiempo agotado obteniendo ubicación. Intenta de nuevo.')
        } else {
          toast.error('No se pudo obtener tu ubicación')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (!status) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No se pudo cargar la información del plantel.
        </CardContent>
      </Card>
    )
  }

  const { plantel, lastPing } = status

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Aviso informativo */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-semibold mb-1">Información importante</p>
              <p>
                El registro de asistencia lo realiza tu profesor. Esta función es{' '}
                <strong>solo informativa</strong>: permite a tu representante ver tu última
                ubicación conocida. No reemplaza el control de asistencia del profesor.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estado actual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            Mi ubicación
          </CardTitle>
          <CardDescription>
            Reporta tu ubicación para que tu representante pueda verte en el mapa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Última ubicación */}
          {lastPing ? (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-sm">Última ubicación reportada</span>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                {lastPing.lat.toFixed(5)}, {lastPing.lng.toFixed(5)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(lastPing.timestamp).toLocaleString('es-VE', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              <Crosshair className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Aún no has reportado tu ubicación hoy
            </div>
          )}

          {/* Último reporte */}
          {lastReport && (
            <div
              className={`rounded-lg p-3 text-sm ${
                lastReport.dentroGeocerca
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {lastReport.dentroGeocerca ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span className="font-medium">{lastReport.message}</span>
              </div>
            </div>
          )}

          {/* Botón reportar */}
          <Button
            onClick={handleReportLocation}
            disabled={reporting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            size="lg"
          >
            {reporting ? (
              <>
                <Navigation className="w-5 h-5 mr-2 animate-pulse" />
                Obteniendo ubicación...
              </>
            ) : (
              <>
                <Crosshair className="w-5 h-5 mr-2" />
                Reportar mi ubicación
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Info del plantel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Satellite className="w-4 h-4 text-emerald-600" />
            Plantel: {plantel.nombre}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5" /> Radio permitido
            </span>
            <Badge variant="secondary">{plantel.radioM}m</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Ubicación
            </span>
            <span className="font-mono text-xs">
              {plantel.lat.toFixed(4)}, {plantel.lng.toFixed(4)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Nota final */}
      <div className="text-center text-xs text-muted-foreground px-4">
        <Clock className="w-3.5 h-3.5 inline mr-1" />
        La ubicación se actualiza solo cuando presionas el botón.
        <br />
        El profesor lleva el control oficial de tu asistencia.
      </div>
    </div>
  )
}
