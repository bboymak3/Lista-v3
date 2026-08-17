'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Camera, Lock, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Profile {
  id: string
  cedula: string
  nombre: string
  apellido: string
  email: string | null
  telefono: string | null
  whatsapp: string | null
  fotoKey: string | null
  rol: string
}

export function ProfileEditor() {
  const user = useAuthStore((s) => s.user)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Editable según rol
  const canEdit = (field: string) => {
    if (!user) return false
    if (user.rol === 'alumno') return false
    if (user.rol === 'super_admin') return true
    if (user.rol === 'admin') return field !== 'cedula'
    // profesor, representante
    return ['telefono', 'whatsapp', 'fotoKey'].includes(field)
  }

  const loadProfile = async () => {
    try {
      const data = await api.get<{ profile: Profile }>('/profile')
      setProfile(data.profile)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProfile() }, [])

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    try {
      const data: Record<string, unknown> = {}
      if (canEdit('nombre')) data.nombre = profile.nombre
      if (canEdit('apellido')) data.apellido = profile.apellido
      if (canEdit('email')) data.email = profile.email
      if (canEdit('telefono')) data.telefono = profile.telefono
      if (canEdit('whatsapp')) data.whatsapp = profile.whatsapp
      await api.put('/profile', data)
      toast.success('Perfil actualizado')
      await loadProfile()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = useAuthStore.getState().token
      const res = await fetch('/api/profile/photo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setProfile({ ...profile, fotoKey: data.fotoKey })
      toast.success('Foto actualizada')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className="h-48 bg-muted animate-pulse rounded-lg" />
  }

  if (!profile) return null

  const initials = `${profile.nombre[0] || ''}${profile.apellido[0] || ''}`.toUpperCase()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {user?.rol === 'alumno' && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6 text-sm text-amber-700">
            Tu perfil es gestionado por la dirección. Si necesitas algún cambio, comunícate con ellos.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Mi Perfil</CardTitle>
          <CardDescription>
            {user?.rol === 'alumno'
              ? 'Información de tu cuenta (solo lectura)'
              : 'Actualiza tu información de contacto'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Foto */}
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20 border-4 border-emerald-100 dark:border-emerald-950">
              {profile.fotoKey ? (
                <AvatarImage src={`/api/files/${profile.fotoKey}`} alt="Foto" />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {canEdit('fotoKey') && (
              <div>
                <Label htmlFor="photo-input" className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span>
                      {uploading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo...</>
                      ) : (
                        <><Camera className="w-4 h-4 mr-2" /> {profile.fotoKey ? 'Cambiar foto' : 'Subir foto'}</>
                      )}
                    </span>
                  </Button>
                </Label>
                <Input
                  id="photo-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhoto}
                  disabled={uploading}
                />
              </div>
            )}
          </div>

          {/* Campos bloqueados */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Cédula {!canEdit('cedula') && <Lock className="w-3 h-3 text-muted-foreground" />}
              </Label>
              <Input
                value={profile.cedula}
                disabled
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Nombre {!canEdit('nombre') && <Lock className="w-3 h-3 text-muted-foreground" />}
              </Label>
              <Input
                value={profile.nombre}
                onChange={(e) => canEdit('nombre') && setProfile({ ...profile, nombre: e.target.value })}
                disabled={!canEdit('nombre')}
                className={!canEdit('nombre') ? 'bg-muted/50' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Apellido {!canEdit('apellido') && <Lock className="w-3 h-3 text-muted-foreground" />}
              </Label>
              <Input
                value={profile.apellido}
                onChange={(e) => canEdit('apellido') && setProfile({ ...profile, apellido: e.target.value })}
                disabled={!canEdit('apellido')}
                className={!canEdit('apellido') ? 'bg-muted/50' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Email {!canEdit('email') && <Lock className="w-3 h-3 text-muted-foreground" />}
              </Label>
              <Input
                type="email"
                value={profile.email || ''}
                onChange={(e) => canEdit('email') && setProfile({ ...profile, email: e.target.value })}
                disabled={!canEdit('email')}
                className={!canEdit('email') ? 'bg-muted/50' : ''}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={profile.telefono || ''}
                onChange={(e) => setProfile({ ...profile, telefono: e.target.value })}
                disabled={!canEdit('telefono')}
                className={!canEdit('telefono') ? 'bg-muted/50' : ''}
                placeholder="0412-0000000"
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={profile.whatsapp || ''}
                onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })}
                disabled={!canEdit('whatsapp')}
                className={!canEdit('whatsapp') ? 'bg-muted/50' : ''}
                placeholder="58412000000 (sin +)"
              />
            </div>
          </div>

          {user?.rol !== 'alumno' && (
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Guardar cambios</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
