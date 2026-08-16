'use client'

import { useEffect, useRef, useState } from 'react'
import { api, apiFetch } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  FileText,
  Upload,
  Send,
  Users,
  GraduationCap,
  RefreshCw,
  CheckCircle2,
  FileUp,
  Paperclip,
} from 'lucide-react'

interface SectionItem {
  id: string
  nombre: string
  grado: string
  turno: string
  plantel: { id: string; nombre: string } | null
  studentCount: number
}

type Destinatarios = 'representantes' | 'alumnos' | 'ambos'

function capitalizeTurno(turno: string): string {
  const map: Record<string, string> = {
    manana: 'Mañana',
    tarde: 'Tarde',
    nocturno: 'Nocturno',
  }
  return map[turno] || turno
}

export function SendPdf() {
  const token = useAuthStore((s) => s.token)
  const [sections, setSections] = useState<SectionItem[]>([])
  const [loadingSections, setLoadingSections] = useState(true)

  const [sectionId, setSectionId] = useState<string>('')
  const [contenido, setContenido] = useState('')
  const [destinatarios, setDestinatarios] = useState<Destinatarios>('representantes')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<{ destinatarios: number } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSections()
  }, [])

  const loadSections = async () => {
    setLoadingSections(true)
    try {
      const data = await api.get<{ data: SectionItem[] }>('/admin/sections')
      setSections(data.data || [])
      if (data.data && data.data.length > 0 && !sectionId) {
        setSectionId(data.data[0].id)
      }
    } catch (e: unknown) {
      toast.error('Error al cargar secciones: ' + (e as Error).message)
    } finally {
      setLoadingSections(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) {
      setFile(null)
      return
    }
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Solo se permiten archivos PDF')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (f.size > 15 * 1024 * 1024) {
      toast.error('El PDF no debe superar 15MB')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setFile(f)
    setSent(null)
  }

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Selecciona un archivo PDF')
      return
    }
    if (!sectionId) {
      toast.error('Selecciona una sección')
      return
    }
    setSending(true)
    setSent(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sectionId', sectionId)
      formData.append('contenido', contenido)
      formData.append('destinatarios', destinatarios)
      const data = await apiFetch<{ ok: boolean; postId: string; destinatarios: number }>(
        '/admin/send-pdf',
        {
          method: 'POST',
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      )
      setSent({ destinatarios: data.destinatarios })
      toast.success(`PDF enviado a ${data.destinatarios} destinatario(s)`)
      // Reset form
      setFile(null)
      setContenido('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e: unknown) {
      toast.error('Error al enviar PDF: ' + (e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const selectedSection = sections.find((s) => s.id === sectionId)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-emerald-600" />
          Enviar PDF a Sección
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Adjunta un documento PDF y notifícalo a una sección
        </p>
      </div>

      {loadingSections ? (
        <div className="space-y-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No hay secciones disponibles</p>
            <p className="text-sm mt-1">
              Crea una sección primero desde el panel de Secciones.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* === FORM === */}
          <Card className="lg:col-span-2 border-emerald-200 dark:border-emerald-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileUp className="w-5 h-5 text-emerald-600" />
                Nuevo envío
              </CardTitle>
              <CardDescription>
                Completa el formulario para enviar un PDF a una sección
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Sección selector */}
              <div className="space-y-2">
                <Label htmlFor="section" className="flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                  Sección destino
                </Label>
                <Select value={sectionId} onValueChange={(v) => { setSectionId(v); setSent(null) }}>
                  <SelectTrigger id="section" className="w-full">
                    <SelectValue placeholder="Selecciona una sección" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre} · {s.grado}° · {capitalizeTurno(s.turno)}
                        {s.plantel ? ` · ${s.plantel.nombre}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSection && (
                  <p className="text-xs text-muted-foreground">
                    {selectedSection.studentCount} estudiante(s) en la sección
                  </p>
                )}
              </div>

              {/* Destinatarios toggle */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Destinatarios
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <DestinatarioButton
                    active={destinatarios === 'representantes'}
                    onClick={() => { setDestinatarios('representantes'); setSent(null) }}
                    icon={<Users className="w-4 h-4" />}
                    label="Representantes"
                  />
                  <DestinatarioButton
                    active={destinatarios === 'alumnos'}
                    onClick={() => { setDestinatarios('alumnos'); setSent(null) }}
                    icon={<GraduationCap className="w-4 h-4" />}
                    label="Alumnos"
                  />
                  <DestinatarioButton
                    active={destinatarios === 'ambos'}
                    onClick={() => { setDestinatarios('ambos'); setSent(null) }}
                    icon={<Users className="w-4 h-4" />}
                    label="Ambos"
                  />
                </div>
              </div>

              {/* PDF input */}
              <div className="space-y-2">
                <Label htmlFor="pdf" className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Archivo PDF
                  <Badge variant="outline" className="ml-1 text-[10px]">Máx 15MB</Badge>
                </Label>
                <Input
                  id="pdf"
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                />
                {file && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3">
                    <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB · PDF
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      Quitar
                    </Button>
                  </div>
                )}
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label htmlFor="contenido" className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Mensaje / Descripción
                  <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Textarea
                  id="contenido"
                  placeholder="Ej: Boletín informativo del mes, circular para los representantes…"
                  value={contenido}
                  onChange={(e) => { setContenido(e.target.value); setSent(null) }}
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {contenido.length}/500
                </p>
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={sending || !file || !sectionId}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                size="lg"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Enviando…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar PDF
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* === SIDE: PREVIEW / HELP === */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  Resumen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Sección: </span>
                  <span className="font-medium">
                    {selectedSection
                      ? `${selectedSection.nombre} · ${selectedSection.grado}°`
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Destinatarios: </span>
                  <span className="font-medium capitalize">{destinatarios}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Archivo: </span>
                  <span className="font-medium text-xs font-mono">
                    {file ? file.name : '—'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {sent && (
              <Card className="border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
                <CardContent className="py-4 flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-emerald-900 dark:text-emerald-200">
                      PDF enviado con éxito
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {sent.destinatarios} destinatario(s) notificados.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-muted/30 border-dashed">
              <CardContent className="py-4 text-xs text-muted-foreground space-y-2">
                <p className="font-medium text-foreground text-sm">Información</p>
                <p>
                  • El PDF se sube a almacenamiento del plantel y queda disponible en el feed de la sección.
                </p>
                <p>
                  • Se genera una notificación push para cada destinatario con su dispositivo Android registrado.
                </p>
                <p>
                  • Solo se aceptan archivos PDF de hasta 15MB.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function DestinatarioButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-lg border-2 text-xs font-medium transition-colors ${
        active
          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'border-muted hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-muted-foreground'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
