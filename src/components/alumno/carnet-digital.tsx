'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
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

interface AlumnoProfile {
  id: string
  codigoUnico: string
  cedulaEscolar: string | null
  nombre: string
  apellido: string
  fechaNacimiento: string | null
  genero: string | null
  qrCode: string
  activo: boolean
  section: SectionInfo
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

export function CarnetDigital() {
  const user = useAuthStore((s) => s.user)
  const [profile, setProfile] = useState<AlumnoProfile | null>(null)
  const [loading, setLoading] = useState(true)

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
        <Button onClick={handleDownload} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" />
          Descargar QR
        </Button>
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
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shrink-0 border-4 border-emerald-100 dark:border-emerald-950">
                {initials}
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
