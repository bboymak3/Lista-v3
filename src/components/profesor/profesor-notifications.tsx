'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Bell,
  CheckCheck,
  AlertCircle,
  Clock,
  Info,
  MapPin,
  Newspaper,
  UserX,
  Clock4,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotificationItem {
  id: string
  tipo: string
  titulo: string
  mensaje: string
  leida: boolean
  createdAt: string
}

interface NotificationResponse {
  notifications: NotificationItem[]
  noLeidas: number
}

const tipoConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  ausencia: {
    icon: <UserX className="w-4 h-4" />,
    color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  },
  tardanza: {
    icon: <Clock4 className="w-4 h-4" />,
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  },
  salida_plantel: {
    icon: <MapPin className="w-4 h-4" />,
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  },
  feed: {
    icon: <Newspaper className="w-4 h-4" />,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  },
  checkin: {
    icon: <Clock className="w-4 h-4" />,
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  },
  general: {
    icon: <Info className="w-4 h-4" />,
    color: 'bg-muted text-muted-foreground',
  },
}

function formatRelative(iso: string): string {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days}d`
  return date.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })
}

export function ProfesorNotifications() {
  const [data, setData] = useState<NotificationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<NotificationResponse>('/notifications')
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

  const handleMark = async (id: string) => {
    setMarkingId(id)
    try {
      await api.put(`/notifications?id=${id}`)
      await load()
    } catch (e: unknown) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setMarkingId(null)
    }
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    try {
      await api.put('/notifications')
      toast.success('Todas las notificaciones marcadas como leídas')
      await load()
    } catch (e: unknown) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setMarkingAll(false)
    }
  }

  const notifications = data?.notifications || []
  const noLeidas = data?.noLeidas || 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-emerald-600" />
            Avisos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {noLeidas > 0
              ? `Tienes ${noLeidas} ${noLeidas === 1 ? 'aviso sin leer' : 'avisos sin leer'}`
              : 'Todo al día'}
          </p>
        </div>
        {noLeidas > 0 && (
          <Button
            onClick={handleMarkAll}
            disabled={markingAll}
            variant="outline"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
          >
            <CheckCheck className="w-4 h-4" />
            {markingAll ? 'Marcando…' : 'Marcar todo como leído'}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificaciones recientes</CardTitle>
          <CardDescription>Últimas 50 notificaciones</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-medium">No tienes avisos</p>
              <p className="text-sm mt-1">Las notificaciones aparecerán aquí</p>
            </div>
          ) : (
            <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
              {notifications.map((n) => {
                const cfg = tipoConfig[n.tipo] || tipoConfig.general
                return (
                  <li
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                      n.leida
                        ? 'bg-background'
                        : 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50'
                    )}
                  >
                    <div
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                        cfg.color
                      )}
                    >
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{n.titulo}</p>
                        {!n.leida && (
                          <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                            Nuevo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 break-words">
                        {n.mensaje}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {formatRelative(n.createdAt)}
                      </p>
                    </div>
                    {!n.leida && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMark(n.id)}
                        disabled={markingId === n.id}
                        className="shrink-0 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                      >
                        <CheckCheck className="w-4 h-4" />
                        <span className="sr-only">Marcar como leído</span>
                      </Button>
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
