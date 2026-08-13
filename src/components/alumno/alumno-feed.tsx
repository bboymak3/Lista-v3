'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Newspaper,
  Camera,
  Megaphone,
  FileText,
  Clock,
  RefreshCw,
  ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FeedPost {
  id: string
  tipo: 'texto' | 'foto' | 'aviso'
  contenido: string
  mediaKey: string | null
  createdAt: string
  profesor: {
    id: string
    nombre: string
    apellido: string
    fotoKey: string | null
  }
  section: { nombre: string; grado: string }
}

type Tipo = 'texto' | 'foto' | 'aviso'

const tipoConfig: Record<Tipo, { label: string; icon: React.ReactNode; badge: string }> = {
  texto: {
    label: 'Mensaje',
    icon: <FileText className="w-3 h-3" />,
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  foto: {
    label: 'Foto',
    icon: <Camera className="w-3 h-3" />,
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  },
  aviso: {
    label: 'Aviso',
    icon: <Megaphone className="w-3 h-3" />,
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
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

export function AlumnoFeed() {
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<{ posts: FeedPost[] }>('/alumno/feed')
      setPosts(data.posts)
    } catch (e: unknown) {
      toast.error('Error al cargar noticias: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Newspaper className="w-6 h-6 text-emerald-600" />
            Noticias de mi Sección
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Avisos y publicaciones de tus profesores
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          <span className="ml-1 hidden sm:inline">Actualizar</span>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-16 w-full mt-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No hay publicaciones todavía</p>
            <p className="text-xs mt-1">
              Cuando tus profesores publiquen avisos o fotos, aparecerán aquí.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1 -mr-1">
          {posts.map((p) => {
            const cfg = tipoConfig[p.tipo] || tipoConfig.texto
            const profesorName = `${p.profesor.nombre} ${p.profesor.apellido}`
            const initials = `${p.profesor.nombre?.[0] || ''}${p.profesor.apellido?.[0] || ''}`.toUpperCase()
            return (
              <Card key={p.id} className="overflow-hidden">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-sm font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{profesorName}</span>
                        <Badge className={cn('text-xs', cfg.badge)}>
                          {cfg.icon}
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Clock className="w-3 h-3" />
                        {formatRelative(p.createdAt)} · Sección {p.section.nombre}
                      </div>

                      <p className="text-sm mt-2.5 whitespace-pre-wrap break-words">
                        {p.contenido}
                      </p>

                      {p.mediaKey && p.tipo === 'foto' && (
                        <button
                          onClick={() => setExpandedPhoto(p.mediaKey.startsWith('/') ? p.mediaKey : `/uploads/${p.mediaKey}`)}
                          className="mt-3 block w-full rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
                        >
                          <img
                            src={p.mediaKey.startsWith('/') ? p.mediaKey : `/uploads/${p.mediaKey}`}
                            alt="Foto adjunta"
                            className="w-full max-h-72 object-cover"
                          />
                        </button>
                      )}

                      {p.mediaKey && p.tipo !== 'foto' && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ImageIcon className="w-3 h-3" />
                          <span>Archivo adjunto</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Lightbox para fotos */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setExpandedPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={expandedPhoto}
              alt="Foto ampliada"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setExpandedPhoto(null)}
              className="absolute top-2 right-2"
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
