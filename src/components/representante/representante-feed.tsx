'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { useRepresentanteStore } from '@/stores/representante-store'
import { ChildSelector } from './child-selector'
import { formatRelative } from './utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import {
  Newspaper,
  Camera,
  Megaphone,
  FileText,
  Users,
} from 'lucide-react'

interface FeedPostItem {
  id: string
  tipo: string
  contenido: string
  mediaKey: string | null
  createdAt: string
  profesor: {
    id: string
    nombre: string
    apellido: string
    fotoKey: string | null
  }
  section: {
    id: string
    nombre: string
  }
}

const tipoMeta: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  texto: { label: 'Mensaje', icon: FileText, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  foto: { label: 'Foto', icon: Camera, color: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300' },
  aviso: { label: 'Aviso', icon: Megaphone, color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
}

export function RepresentanteFeed() {
  const children = useRepresentanteStore((s) => s.children)
  const selectedChildId = useRepresentanteStore((s) => s.selectedChildId)
  const fetchChildren = useRepresentanteStore((s) => s.fetchChildren)
  const loadingChildren = useRepresentanteStore((s) => s.loading)

  const [posts, setPosts] = useState<FeedPostItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchChildren()
  }, [fetchChildren])

  const loadFeed = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<{ posts: FeedPostItem[] }>('/representante/feed')
      setPosts(d.posts || [])
    } catch (e: unknown) {
      toast.error('Error al cargar noticias: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Cargar feed cuando cambia la selección (cualquier hijo dispara el mismo feed,
  // pero recargamos por si las secciones varían).
  useEffect(() => {
    if (children.length === 0) return
    let active = true
    loadFeed().catch(() => {
      // errores ya manejados dentro de loadFeed
    })
    return () => {
      active = false
    }
  }, [selectedChildId, children.length, loadFeed])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-emerald-600" />
          Noticias de la sección
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Avisos y publicaciones de los profesores
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

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-2 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No hay publicaciones todavía</p>
              <p className="text-sm mt-1">
                Los avisos de los profesores aparecerán aquí.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[70vh] pr-4">
              <ul className="space-y-4">
                {posts.map((p) => {
                  const meta = tipoMeta[p.tipo] || tipoMeta.texto
                  const Icon = meta.icon
                  const initials = `${p.profesor.nombre?.[0] || ''}${p.profesor.apellido?.[0] || ''}`.toUpperCase()
                  return (
                    <li key={p.id}>
                      <article className="rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow">
                        {/* Header del post */}
                        <div className="flex items-center gap-3 mb-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-sm font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">
                              {p.profesor.nombre} {p.profesor.apellido}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Sección {p.section.nombre} · {formatRelative(p.createdAt)}
                            </p>
                          </div>
                          <Badge variant="outline" className={meta.color + ' border-transparent'}>
                            <Icon className="w-3 h-3 mr-1" />
                            {meta.label}
                          </Badge>
                        </div>
                        {/* Contenido */}
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                          {p.contenido}
                        </p>
                        {/* Foto real */}
                        {p.mediaKey && (
                          <div className="mt-3 rounded-lg overflow-hidden border border-emerald-200 dark:border-emerald-900">
                            <img
                              src={p.mediaKey.startsWith('/') ? p.mediaKey : `/uploads/${p.mediaKey}`}
                              alt="Foto adjunta"
                              className="w-full max-h-96 object-cover"
                              loading="lazy"
                              onError={(e) => {
                                const t = e.currentTarget
                                t.style.display = 'none'
                                const fallback = document.createElement('div')
                                fallback.className = 'p-6 flex items-center justify-center gap-3 text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20'
                                fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg><span class="text-sm font-medium">Imagen no disponible</span>'
                                t.parentElement?.appendChild(fallback)
                              }}
                            />
                          </div>
                        )}
                      </article>
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
