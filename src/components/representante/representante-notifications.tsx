'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { formatRelative, formatTime, notifStyle } from './utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  Bell,
  BellOff,
  CheckCheck,
  AlertTriangle,
  Clock,
  Megaphone,
  MapPin,
  Newspaper,
  CheckCircle2,
  Info,
} from 'lucide-react'

interface NotificationItem {
  id: string
  tipo: string
  titulo: string
  mensaje: string
  leida: boolean
  createdAt: string
}

const tipoIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  ausencia: AlertTriangle,
  ausente: AlertTriangle,
  tardanza: Clock,
  feed: Newspaper,
  salida_plantel: MapPin,
  checkin: CheckCircle2,
  general: Info,
}

function NotifIcon({ tipo, className }: { tipo: string; className?: string }) {
  const Icon = tipoIcon[tipo] || Bell
  return <Icon className={className} />
}

export function RepresentanteNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<{
        notifications: NotificationItem[]
        noLeidas: number
      }>('/representante/notifications')
      setItems(d.notifications || [])
      setNoLeidas(d.noLeidas || 0)
    } catch (e: unknown) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const markAsRead = async (id: string) => {
    setMarkingId(id)
    try {
      // El endpoint PUT /api/notifications?id=xxx marca como leída
      await api.put(`/notifications?id=${id}`)
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
      )
      setNoLeidas((n) => Math.max(0, n - 1))
    } catch (e: unknown) {
      toast.error('No se pudo marcar: ' + (e as Error).message)
    } finally {
      setMarkingId(null)
    }
  }

  const markAllAsRead = async () => {
    setMarkingAll(true)
    try {
      await api.put('/notifications')
      setItems((prev) => prev.map((n) => ({ ...n, leida: true })))
      setNoLeidas(0)
      toast.success('Todas las notificaciones marcadas como leídas')
    } catch (e: unknown) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-emerald-600" />
            Avisos y notificaciones
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {noLeidas > 0
              ? `Tienes ${noLeidas} notificación${noLeidas === 1 ? '' : 'es'} sin leer`
              : 'No tienes avisos sin leer'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={markAllAsRead}
          disabled={markingAll || noLeidas === 0}
          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
        >
          <CheckCheck className="w-4 h-4 mr-2" />
          {markingAll ? 'Marcando…' : 'Marcar todo como leído'}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BellOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No tienes notificaciones</p>
              <p className="text-sm mt-1">
                Los avisos sobre asistencia y novedades aparecerán aquí.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[70vh] pr-4">
              <ul className="space-y-2">
                {items.map((n) => {
                  const style = notifStyle(n.tipo)
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => !n.leida && markAsRead(n.id)}
                        disabled={n.leida || markingId === n.id}
                        className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 transition-colors ${
                          n.leida
                            ? 'border-border bg-card hover:bg-accent/30'
                            : `border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer`
                        }`}
                      >
                        {/* Icono */}
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${style.bg} ${style.icon}`}
                        >
                          <NotifIcon tipo={n.tipo} className="w-5 h-5" />
                        </div>

                        {/* Contenido */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <p
                              className={`text-sm ${
                                n.leida
                                  ? 'font-medium text-foreground'
                                  : 'font-semibold text-foreground'
                              }`}
                            >
                              {n.titulo}
                            </p>
                            {!n.leida && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {n.mensaje}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize border-transparent ${style.bg} ${style.text}`}
                            >
                              <Megaphone className="w-2.5 h-2.5 mr-1" />
                              {n.tipo}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatRelative(n.createdAt)} ·{' '}
                              {formatTime(n.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Estado */}
                        <div className="shrink-0">
                          {n.leida ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              <CheckCheck className="w-3 h-3 mr-1" />
                              Leída
                            </Badge>
                          ) : markingId === n.id ? (
                            <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400">
                              <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-1 inline-block" />
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                            >
                              Nuevo
                            </Badge>
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
