'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api, apiFetch } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import {
  QrCode,
  School,
  Hash,
  IdCard,
  Calendar,
  User,
  ShieldCheck,
  Download,
  RefreshCw,
  MessageCircle,
  Phone,
  Camera,
  Upload,
  Users,
  FileText,
} from 'lucide-react'

interface PlantelInfo {
  id: string
  nombre: string
  direccion: string | null
  lat: number
  lng: number
  radioM: number
  periodoActual: string
}

interface SectionInfo {
  id: string
  nombre: string
  grado: string
  turno: string
  periodoEscolar: string
  plantel: PlantelInfo
}

interface RepresentanteInfo {
  id: string
  nombre: string
  apellido: string
  telefono: string | null
  whatsapp: string | null
  parentesco: string
  esPrincipal: boolean
}

interface AlumnoProfile {
  id: string
  codigoUnico: string
  cedulaEscolar: string | null
  nombre: string
  apellido: string
  fechaNacimiento: string | null
  genero: string | null
  qrCode: string
  fotoKey: string | null
  activo: boolean
  section: SectionInfo
  representantes?: RepresentanteInfo[]
}

function capitalizeTurno(turno: string): string {
  const map: Record<string, string> = {
    manana: 'Mañana',
    tarde: 'Tarde',
    nocturno: 'Nocturno',
  }
  return map[turno] || turno
}

function calcularEdad(fechaNac: string | null): string {
  if (!fechaNac) return '—'
  try {
    const nac = new Date(fechaNac)
    const now = new Date()
    let edad = now.getFullYear() - nac.getFullYear()
    const m = now.getMonth() - nac.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < nac.getDate())) edad--
    return `${edad} años`
  } catch {
    return '—'
  }
}

function parentescoLabel(p: string): string {
  const map: Record<string, string> = {
    madre: 'Madre',
    padre: 'Padre',
    tutor: 'Tutor/a',
    otro: 'Representante',
  }
  return map[p] || p
}

// Normaliza un número de teléfono a dígitos (sin +, espacios ni guiones)
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/[^\d]/g, '')
  return digits.length >= 8 ? digits : null
}

export function CarnetDigital() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const [profile, setProfile] = useState<AlumnoProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get<AlumnoProfile>('/alumno/profile')
      setProfile(data)
    } catch (e: unknown) {
      toast.error('Error al cargar perfil: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleDownload = () => {
    const svg = document.querySelector('#carnet-qr-svg') as SVGElement | null
    if (!svg) {
      toast.error('No se pudo encontrar el código QR')
      return
    }
    const serializer = new XMLSerializer()
    const source = serializer.serializeToString(svg)
    const blob = new Blob([source], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `carnet-${profile?.codigoUnico || 'alumno'}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Código QR descargado')
  }

  const handleDownloadCarnetPdf = () => {
    const token = useAuthStore.getState().token
    const url = `/api/alumno/carnet-pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`
    window.open(url, '_blank', 'noopener,noreferrer')
    toast.success('Generando carnet PDF…')
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('La imagen no debe superar 15MB')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('estudianteId', profile.id)
      const data = await apiFetch<{ mediaKey: string }>('/alumno/photo', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      setProfile({ ...profile, fotoKey: data.mediaKey })
      toast.success('Foto de perfil actualizada')
    } catch (err: unknown) {
      toast.error('Error al subir foto: ' + (err as Error).message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="w-6 h-6 text-emerald-600" />
            Carnet Digital
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tu identificación escolar digital
          </p>
        </div>
        <Skeleton className="h-[28rem] w-full max-w-md" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="w-6 h-6 text-emerald-600" />
            Carnet Digital
          </h2>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No se pudo cargar el perfil del estudiante.
            <div className="mt-4">
              <Button onClick={load} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-1" />
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const initials = `${profile.nombre?.[0] || ''}${profile.apellido?.[0] || ''}`.toUpperCase()
  const section = profile.section
  const representantes = profile.representantes || []
  const representantePrincipal = representantes.find((r) => r.esPrincipal) || representantes[0] || null
  const whatsappNumber = normalizePhone(representantePrincipal?.whatsapp || representantePrincipal?.telefono)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="w-6 h-6 text-emerald-600" />
            Carnet Digital
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tu identificación escolar digital · muéstralo en el plantel
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleDownloadCarnetPdf} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileText className="w-4 h-4 mr-1" />
            Descargar Carnet PDF
          </Button>
          <Button onClick={handleDownload} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1" />
            Descargar QR
          </Button>
        </div>
      </div>

      {/* === TARJETA DE CARNET === */}
      <div className="flex justify-center">
        <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-xl border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-card">
          {/* Encabezado de la tarjeta */}
          <div className="relative bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 p-5 text-white">
            <div className="absolute inset-0 opacity-15 pointer-events-none">
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/30 blur-2xl" />
              <div className="absolute bottom-0 left-1/3 w-24 h-24 rounded-full bg-teal-300/30 blur-2xl" />
            </div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                  <School className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-base leading-tight">
                    {section.plantel.nombre}
                  </p>
                  <p className="text-xs text-emerald-50/90 leading-tight">
                    {section.plantel.periodoActual}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-white/20 backdrop-blur text-white border border-white/30">
                Estudiante
              </span>
            </div>
            <div className="relative mt-3">
              <p className="text-[10px] uppercase tracking-widest text-emerald-50/80 font-semibold">
                Sistema de Asistencia · Lista
              </p>
            </div>
          </div>

          {/* Cuerpo de la tarjeta */}
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <Avatar className="w-16 h-16 border-4 border-emerald-100 dark:border-emerald-950">
                  {profile.fotoKey ? (
                    <AvatarImage
                      src={`/api/files/${profile.fotoKey}`}
                      alt={`${profile.nombre} ${profile.apellido}`}
                    />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-2xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {user?.rol === 'alumno' && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    title="Cambiar foto"
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-emerald-950 disabled:opacity-50"
                  >
                    {uploading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Camera className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight">
                  {profile.nombre} {profile.apellido}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  Sección {section.nombre} · {capitalizeTurno(section.turno)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {calcularEdad(profile.fechaNacimiento)}{' '}
                  {profile.genero
                    ? `· ${
                        profile.genero === 'M'
                          ? 'Masculino'
                          : profile.genero === 'F'
                          ? 'Femenino'
                          : 'Otro'
                      }`
                    : ''}
                </p>
              </div>
            </div>

            {/* Datos en grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-md bg-muted/50 p-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Hash className="w-3 h-3" />
                  <span className="uppercase tracking-wide">Código</span>
                </div>
                <p className="font-mono font-semibold text-sm mt-1">{profile.codigoUnico}</p>
              </div>
              <div className="rounded-md bg-muted/50 p-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <IdCard className="w-3 h-3" />
                  <span className="uppercase tracking-wide">Cédula</span>
                </div>
                <p className="font-mono font-semibold text-sm mt-1">
                  {profile.cedulaEscolar || user?.cedula || '—'}
                </p>
              </div>
              <div className="rounded-md bg-muted/50 p-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <School className="w-3 h-3" />
                  <span className="uppercase tracking-wide">Plantel</span>
                </div>
                <p className="font-semibold text-sm mt-1 truncate">{section.plantel.nombre}</p>
              </div>
              <div className="rounded-md bg-muted/50 p-2.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span className="uppercase tracking-wide">Grado</span>
                </div>
                <p className="font-semibold text-sm mt-1">{section.nombre}</p>
              </div>
            </div>

            {/* QR scannable */}
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="p-3 rounded-xl bg-white border-2 border-emerald-200 dark:border-emerald-900">
                <QRCodeSVG
                  id="carnet-qr-svg"
                  value={profile.qrCode}
                  size={160}
                  level="M"
                  includeMargin={false}
                  fgColor="#047857"
                  bgColor="#ffffff"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Escanea para registrar asistencia
              </p>
              <p className="font-mono text-[10px] text-muted-foreground/70 break-all text-center max-w-xs">
                {profile.qrCode}
              </p>
            </div>
          </div>

          {/* Footer de la tarjeta */}
          <div className="border-t bg-emerald-50 dark:bg-emerald-950/30 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Carnet válido · {section.plantel.periodoActual}</span>
            </div>
            <Badge variant={profile.activo ? 'default' : 'secondary'}>
              {profile.activo ? 'ACTIVO' : 'INACTIVO'}
            </Badge>
          </div>
        </div>
      </div>

      {/* === REPRESENTANTE / WHATSAPP === */}
      {representantePrincipal && (
        <Card className="border-emerald-200 dark:border-emerald-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              Representante
              {representantePrincipal.esPrincipal && (
                <Badge
                  variant="outline"
                  className="ml-1 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                >
                  Principal
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-semibold text-sm">
                  {representantePrincipal.nombre} {representantePrincipal.apellido}
                </p>
                <p className="text-xs text-muted-foreground">
                  {parentescoLabel(representantePrincipal.parentesco)}
                </p>
              </div>
              {whatsappNumber && (
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {representantePrincipal.telefono && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="w-3 h-3" />
                  <span>Teléfono: </span>
                  <span className="font-mono font-semibold text-foreground">
                    {representantePrincipal.telefono}
                  </span>
                </div>
              )}
              {representantePrincipal.whatsapp && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MessageCircle className="w-3 h-3" />
                  <span>WhatsApp: </span>
                  <span className="font-mono font-semibold text-foreground">
                    {representantePrincipal.whatsapp}
                  </span>
                </div>
              )}
            </div>

            {representantes.length > 1 && (
              <div className="pt-3 border-t">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                  Otros representantes
                </p>
                <div className="space-y-2">
                  {representantes
                    .filter((r) => r.id !== representantePrincipal.id)
                    .map((r) => {
                      const wNum = normalizePhone(r.whatsapp || r.telefono)
                      return (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-medium">
                              {r.nombre} {r.apellido}
                            </span>
                            <span className="text-muted-foreground ml-1">
                              · {parentescoLabel(r.parentesco)}
                            </span>
                          </div>
                          {wNum && (
                            <a
                              href={`https://wa.me/${wNum}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 transition-colors"
                            >
                              <MessageCircle className="w-3 h-3" />
                              WhatsApp
                            </a>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* === FOTO UPLOAD (alumno only) === */}
      {user?.rol === 'alumno' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-600" />
              Foto de perfil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16 border-2 border-emerald-100 dark:border-emerald-950">
                {profile.fotoKey ? (
                  <AvatarImage
                    src={`/api/files/${profile.fotoKey}`}
                    alt="Foto de perfil"
                  />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">
                  {profile.fotoKey
                    ? 'Tienes una foto de perfil cargada.'
                    : 'Aún no tienes foto de perfil.'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      Subiendo…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-1" />
                      {profile.fotoKey ? 'Cambiar foto' : 'Subir foto'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info adicional */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <School className="w-4 h-4 text-emerald-600" />
              Plantel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{section.plantel.nombre}</p>
            {section.plantel.direccion && (
              <p className="text-muted-foreground text-xs">{section.plantel.direccion}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Geocerca: {section.plantel.radioM} m de radio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              Datos personales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Cédula: </span>
              <span className="font-mono">
                {profile.cedulaEscolar || user?.cedula || '—'}
              </span>
            </p>
            {profile.fechaNacimiento && (
              <p>
                <span className="text-muted-foreground">Nacimiento: </span>
                <span>
                  {new Date(profile.fechaNacimiento).toLocaleDateString('es-VE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </p>
            )}
            <p>
              <span className="text-muted-foreground">Período: </span>
              <span>{section.periodoEscolar}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
