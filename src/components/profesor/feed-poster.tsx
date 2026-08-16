'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Camera,
  Megaphone,
  FileText,
  FileType,
  Image as ImageIcon,
  Send,
  Newspaper,
  Clock,
  X,
  ExternalLink,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

interface SectionItem {
  id: string
  nombre: string
  grado: string
  turno: string
  plantel: string
  rol: string
  studentCount: number
}

interface FeedPost {
  id: string
  tipo: 'texto' | 'foto' | 'aviso' | 'pdf'
  contenido: string
  mediaKey: string | null
  createdAt: string
  section: { nombre: string; grado: string }
  destinatarios?: string | null
}

type Tipo = 'texto' | 'foto' | 'aviso' | 'pdf'
type Destinatarios = 'representantes' | 'alumnos' | 'ambos'

const tipoConfig: Record<Tipo, { label: string; icon: React.ReactNode; badge: string }> = {
  texto: {
    label: 'Texto',
    icon: <FileText className="w-4 h-4" />,
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  foto: {
    label: 'Foto',
    icon: <Camera className="w-4 h-4" />,
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  },
  aviso: {
    label: 'Aviso',
    icon: <Megaphone className="w-4 h-4" />,
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  pdf: {
    label: 'PDF',
    icon: <FileType className="w-4 h-4" />,
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  },
}

const destinatariosConfig: Record<Destinatarios, { label: string }> = {
  representantes: { label: 'Representantes' },
  alumnos: { label: 'Alumnos' },
  ambos: { label: 'Ambos' },
}

function fileUrl(mediaKey: string | null): string | null {
  if (!mediaKey) return null
  if (mediaKey.startsWith('http') || mediaKey.startsWith('/api/')) return mediaKey
  if (mediaKey.startsWith('/')) return `/api/files${mediaKey}`
  return `/api/files/${mediaKey}`
}

function isPdfKey(mediaKey: string | null): boolean {
  if (!mediaKey) return false
  return mediaKey.toLowerCase().endsWith('.pdf')
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

export function FeedPoster() {
  const user = useAuthStore((s) => s.user)
  const [sections, setSections] = useState<SectionItem[]>([])
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [tipo, setTipo] = useState<Tipo>('texto')
  const [destinatarios, setDestinatarios] = useState<Destinatarios>('representantes')
  const [contenido, setContenido] = useState('')
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [posting, setPosting] = useState(false)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPosts, setLoadingPosts] = useState(true)

  useEffect(() => {
    api
      .get<{ sections: SectionItem[] }>('/profesor/sections')
      .then((data) => {
        setSections(data.sections)
        if (data.sections[0]) setSelectedSection(data.sections[0].id)
      })
      .catch((e) => toast.error('Error: ' + e.message))
      .finally(() => setLoading(false))
  }, [])

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true)
    try {
      const data = await api.get<{ posts: FeedPost[] }>('/profesor/feed')
      setPosts(data.posts)
    } catch (e: unknown) {
      toast.error('Error al cargar publicaciones: ' + (e as Error).message)
    } finally {
      setLoadingPosts(false)
    }
  }, [])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  // Al cambiar de tipo, limpiar archivo seleccionado
  const handleTipoChange = (t: Tipo) => {
    setTipo(t)
    clearMedia()
  }

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (tipo === 'foto') {
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten imágenes')
        return
      }
      if (file.size > 15 * 1024 * 1024) {
        toast.error('La imagen no debe superar 15MB')
        return
      }
    } else if (tipo === 'pdf') {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('Solo se permiten archivos PDF')
        return
      }
      if (file.size > 15 * 1024 * 1024) {
        toast.error('El PDF no debe superar 15MB')
        return
      }
    }

    setMediaFile(file)
    // Preview local
    if (tipo === 'foto') {
      const reader = new FileReader()
      reader.onload = () => setMediaPreview(reader.result as string)
      reader.readAsDataURL(file)
    } else {
      // Para PDFs no generamos thumbnail de datos, solo guardamos nombre
      setMediaPreview(file.name)
    }
  }

  const clearMedia = () => {
    setMediaPreview(null)
    setMediaFile(null)
    const input = document.getElementById('media-input') as HTMLInputElement | null
    if (input) input.value = ''
  }

  const handlePost = async () => {
    if (!selectedSection) {
      toast.error('Selecciona una sección')
      return
    }
    if (!contenido.trim()) {
      toast.error('Escribe el contenido')
      return
    }
    if ((tipo === 'foto' || tipo === 'pdf') && !mediaFile) {
      toast.error(tipo === 'foto' ? 'Agrega una foto' : 'Agrega un PDF')
      return
    }
    setPosting(true)
    try {
      let mediaKey: string | undefined
      // Si hay archivo (foto o PDF), subirlo primero a /api/upload
      if (mediaFile) {
        const formData = new FormData()
        formData.append('file', mediaFile)
        const token = useAuthStore.getState().token
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al subir archivo')
        mediaKey = data.mediaKey
      }
      await api.post('/profesor/feed', {
        sectionId: selectedSection,
        tipo,
        contenido: contenido.trim(),
        mediaKey,
        destinatarios,
      })
      const destLabel = destinatarios === 'ambos' ? 'representantes y alumnos' : destinatarios
      toast.success(`Publicación enviada a los ${destLabel}`)
      setContenido('')
      clearMedia()
      await loadPosts()
    } catch (e: unknown) {
      toast.error('Error: ' + (e as Error).message)
    } finally {
      setPosting(false)
    }
  }

  const acceptAttr = tipo === 'foto' ? 'image/*' : tipo === 'pdf' ? '.pdf,application/pdf' : undefined
  const captureAttr = tipo === 'foto' ? 'environment' : undefined

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-emerald-600" />
          Publicar en el Feed
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Envía avisos, noticias, fotos o PDFs a los representantes y alumnos de tus secciones.
        </p>
      </div>

      {/* Composer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva publicación</CardTitle>
          <CardDescription>Se enviará notificación a los destinatarios seleccionados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Section + Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="section-select">Sección</Label>
              {loading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger id="section-select" className="w-full">
                    <SelectValue placeholder="Selecciona sección" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre} · {s.plantel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(tipoConfig) as Tipo[]).map((t) => {
                  const Icon = tipoConfig[t].icon
                  const isActive = tipo === t
                  return (
                    <button
                      key={t}
                      onClick={() => handleTipoChange(t)}
                      className={cn(
                        'flex flex-col items-center gap-1 py-2 px-1 rounded-md border text-xs font-medium transition-all',
                        isActive
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'border-border text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {Icon}
                      {tipoConfig[t].label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Destinatarios */}
          <div className="space-y-1.5">
            <Label htmlFor="destinatarios-select">Enviar a</Label>
            <Select value={destinatarios} onValueChange={(v) => setDestinatarios(v as Destinatarios)}>
              <SelectTrigger id="destinatarios-select" className="w-full">
                <SelectValue placeholder="Selecciona destinatarios" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(destinatariosConfig) as Destinatarios[]).map((d) => (
                  <SelectItem key={d} value={d}>
                    <span className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      {destinatariosConfig[d].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="contenido">Contenido</Label>
            <Textarea
              id="contenido"
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              placeholder={
                tipo === 'aviso'
                  ? 'Escribe el aviso importante…'
                  : tipo === 'foto'
                  ? 'Describe la foto que vas a compartir…'
                  : tipo === 'pdf'
                  ? 'Describe el documento que vas a compartir…'
                  : 'Escribe tu mensaje…'
              }
              rows={4}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {contenido.length}/500
            </p>
          </div>

          {/* Media (foto o PDF) */}
          {(tipo === 'foto' || tipo === 'pdf') && (
            <div className="space-y-2">
              <Label>{tipo === 'foto' ? 'Foto' : 'Documento PDF'}</Label>
              {mediaPreview ? (
                <div className="relative rounded-lg overflow-hidden border">
                  {tipo === 'foto' ? (
                    <img
                      src={mediaPreview}
                      alt="Vista previa"
                      className="w-full max-h-64 object-cover"
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-rose-50/50 dark:bg-rose-950/20">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200">
                        <FileType className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-rose-900 dark:text-rose-100 truncate">
                          {mediaFile?.name || 'documento.pdf'}
                        </p>
                        <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
                          {mediaFile ? `${(mediaFile.size / 1024 / 1024).toFixed(2)} MB` : ''}
                        </p>
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={clearMedia}
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="media-input"
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  {tipo === 'foto' ? (
                    <>
                      <ImageIcon className="w-10 h-10 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        Haz clic para seleccionar o tomar una foto
                      </p>
                      <p className="text-xs text-muted-foreground/70">PNG, JPG · máx 15MB</p>
                    </>
                  ) : (
                    <>
                      <FileType className="w-10 h-10 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        Haz clic para seleccionar un PDF
                      </p>
                      <p className="text-xs text-muted-foreground/70">PDF · máx 15MB</p>
                    </>
                  )}
                  <input
                    id="media-input"
                    type="file"
                    accept={acceptAttr}
                    capture={captureAttr}
                    onChange={handleMediaChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}

          {/* Submit */}
          <Button
            onClick={handlePost}
            disabled={posting || !contenido.trim()}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
          >
            <Send className="w-4 h-4" />
            {posting ? 'Publicando…' : 'Publicar'}
          </Button>
        </CardContent>
      </Card>

      {/* Recent posts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Mis publicaciones recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPosts ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Newspaper className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No has publicado nada todavía</p>
            </div>
          ) : (
            <ul className="space-y-3 max-h-[60vh] overflow-y-auto">
              {posts.map((p) => {
                const cfg = tipoConfig[p.tipo] || tipoConfig.texto
                const mediaSrc = fileUrl(p.mediaKey)
                const showPdf = (p.tipo === 'pdf' || isPdfKey(p.mediaKey)) && !!mediaSrc
                const showImg = !showPdf && p.mediaKey && p.tipo === 'foto' && !!mediaSrc
                const destLabel = p.destinatarios
                  ? destinatariosConfig[p.destinatarios as Destinatarios]?.label || 'Representantes'
                  : 'Representantes'
                return (
                  <li key={p.id} className="rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-semibold">
                          {`${user?.nombre?.[0] || ''}${user?.apellido?.[0] || ''}`.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {user?.nombre} {user?.apellido}
                          </span>
                          <Badge className={cn('text-xs', cfg.badge)}>
                            {cfg.icon}
                            {cfg.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            · {p.section.nombre} · {formatRelative(p.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm mt-1.5 whitespace-pre-wrap break-words">
                          {p.contenido}
                        </p>
                        {showImg && mediaSrc && (
                          <img
                            src={mediaSrc}
                            alt="Foto adjunta"
                            className="mt-2 rounded-md max-h-48 object-cover"
                          />
                        )}
                        {showPdf && mediaSrc && (
                          <a
                            href={mediaSrc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300 hover:underline"
                          >
                            <FileType className="w-3.5 h-3.5" />
                            Ver PDF · {p.mediaKey?.split('/').pop() || 'documento.pdf'}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          <span>Para: {destLabel}</span>
                        </div>
                      </div>
                    </div>
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
