'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Settings,
  MessageCircle,
  Phone,
  Save,
  RefreshCw,
  UserCircle,
  Info,
  CheckCircle2,
} from 'lucide-react'

interface ProfileData {
  id: string
  cedula: string
  nombre: string
  apellido: string
  email: string | null
  telefono: string | null
  whatsapp: string | null
}

function formatPhone(raw: string | null): string {
  if (!raw) return '—'
  // Si es solo dígitos y empieza con código país, mostrar +
  const digits = raw.replace(/[^\d]/g, '')
  if (digits.length >= 10) {
    return `+${digits}`
  }
  return raw
}

export function RepresentanteProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [whatsapp, setWhatsapp] = useState('')
  const [telefono, setTelefono] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get<{ user: ProfileData }>('/representante/profile')
      setProfile(data.user)
      setWhatsapp(data.user.whatsapp || '')
      setTelefono(data.user.telefono || '')
    } catch (e: unknown) {
      toast.error('Error al cargar perfil: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSave = async () => {
    if (!profile) return
    // Validación: dígitos únicos, 8-15 dígitos
    const digits = whatsapp.replace(/[^\d]/g, '')
    if (whatsapp && (digits.length < 8 || digits.length > 15)) {
      toast.error('El número de WhatsApp debe tener entre 8 y 15 dígitos')
      return
    }
    setSaving(true)
    try {
      const body: { whatsapp?: string; telefono?: string } = {}
      // Solo enviar whatsapp si cambió
      const currentWhatsapp = profile.whatsapp || ''
      if (whatsapp !== currentWhatsapp) {
        body.whatsapp = whatsapp
      }
      const currentTelefono = profile.telefono || ''
      if (telefono !== currentTelefono) {
        body.telefono = telefono
      }
      if (Object.keys(body).length === 0) {
        toast.info('No hay cambios para guardar')
        return
      }
      const data = await api.put<{ ok: boolean; user: ProfileData }>('/representante/profile', body)
      setProfile(data.user)
      setWhatsapp(data.user.whatsapp || '')
      setTelefono(data.user.telefono || '')
      toast.success('Perfil actualizado')
    } catch (e: unknown) {
      toast.error('Error al guardar: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-600" />
            Mi Perfil
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configura tu información de contacto
          </p>
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-600" />
            Mi Perfil
          </h2>
        </div>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No se pudo cargar el perfil.
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
  const whatsappDigits = (whatsapp || '').replace(/[^\d]/g, '')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-600" />
          Mi Perfil
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configura tu información de contacto para que el plantel pueda comunicarse contigo
        </p>
      </div>

      {/* Profile summary card */}
      <Card className="overflow-hidden border-emerald-200 dark:border-emerald-900/50">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar className="w-16 h-16 border-2 border-white/30 shrink-0">
                <AvatarFallback className="bg-white/20 text-white text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="text-xl font-bold truncate">
                  {profile.nombre} {profile.apellido}
                </h3>
                <p className="text-emerald-50 text-sm truncate font-mono">
                  {profile.cedula}
                </p>
                {profile.email && (
                  <p className="text-emerald-50/80 text-xs truncate">{profile.email}</p>
                )}
              </div>
            </div>
            <Badge className="bg-white/20 backdrop-blur text-white border border-white/30">
              Representante
            </Badge>
          </div>
        </div>
      </Card>

      {/* WhatsApp + Teléfono edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            Contacto
          </CardTitle>
          <CardDescription>
            Tu número de WhatsApp permite que el plantel te envíe mensajes directos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current values preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
                <Phone className="w-3.5 h-3.5" />
                <span>Teléfono actual</span>
              </div>
              <p className="font-mono font-semibold mt-1">
                {formatPhone(profile.telefono)}
              </p>
            </div>
            <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900 p-3">
              <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 uppercase tracking-wide">
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp actual</span>
              </div>
              <p className="font-mono font-semibold mt-1">
                {profile.whatsapp ? formatPhone(profile.whatsapp) : '—'}
              </p>
            </div>
          </div>

          {/* Editable form */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp" className="flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                Número de WhatsApp
              </Label>
              <Input
                id="whatsapp"
                type="tel"
                inputMode="tel"
                placeholder="Ej: 584121234567"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Formato internacional sin &quot;+&quot;: código de país + número.
                Ej: <span className="font-mono">584121234567</span> para Venezuela.
              </p>
              {whatsapp && whatsappDigits.length >= 8 && (
                <a
                  href={`https://wa.me/${whatsappDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 hover:underline mt-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Probar enlace: wa.me/{whatsappDigits}
                </a>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telefono" className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-emerald-600" />
                Teléfono (opcional)
              </Label>
              <Input
                id="telefono"
                type="tel"
                inputMode="tel"
                placeholder="Ej: 0212-1234567"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground flex items-start gap-1.5 flex-1 min-w-0">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Solo se guardarán los campos que modifiques.
              </span>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  Guardar cambios
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hint card */}
      <Card className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="py-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-emerald-900 dark:text-emerald-200">
              ¿Por qué necesitamos tu WhatsApp?
            </p>
            <p className="text-muted-foreground mt-0.5">
              Lo usamos para enviarte avisos urgentes del plantel: ausencias, tardanzas y
              novedades sobre tus hijos/as.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Profile metadata */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <UserCircle className="w-4 h-4 text-emerald-600" />
            Datos de la cuenta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <p>
              <span className="text-muted-foreground">Cédula: </span>
              <span className="font-mono">{profile.cedula}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Email: </span>
              <span className="font-mono">{profile.email || '—'}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
