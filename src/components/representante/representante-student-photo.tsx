'use client'

import { useRef, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { useRepresentanteStore } from '@/stores/representante-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { Camera, RefreshCw, Upload } from 'lucide-react'

interface RepresentanteStudentPhotoProps {
  /** ID del estudiante (Child.id) */
  estudianteId: string
  /** fotoKey actual del estudiante */
  fotoKey: string | null
  /** Nombre + apellido para mostrar iniciales en el fallback */
  nombre: string
  apellido: string
  /** Callback opcional para actualizar la UI del padre cuando se sube una foto */
  onPhotoChanged?: (newFotoKey: string) => void
}

/**
 * Permite al representante subir/cambiar la foto de perfil del estudiante (su hijo/a).
 * Usa el endpoint /api/alumno/photo (que ya valida ownership para representante).
 */
export function RepresentanteStudentPhoto({
  estudianteId,
  fotoKey,
  nombre,
  apellido,
  onPhotoChanged,
}: RepresentanteStudentPhotoProps) {
  const token = useAuthStore((s) => s.token)
  const fetchChildren = useRepresentanteStore((s) => s.fetchChildren)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5MB')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('estudianteId', estudianteId)
      const data = await apiFetch<{ mediaKey: string }>('/alumno/photo', {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      toast.success('Foto del alumno actualizada')
      onPhotoChanged?.(data.mediaKey)
      // Refrescar la lista de hijos en el store para que se sincronice
      fetchChildren(true).catch(() => {
        /* ignore */
      })
    } catch (err: unknown) {
      toast.error('Error al subir foto: ' + (err as Error).message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-600" />
          Foto del alumno
        </CardTitle>
        <CardDescription>
          Sube o actualiza la foto de perfil de tu hijo/a. Aparecerá en su carnét digital.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 flex-wrap">
          <Avatar className="w-16 h-16 border-2 border-emerald-100 dark:border-emerald-950">
            {fotoKey ? (
              <AvatarImage src={`/api/files/${fotoKey}`} alt={`${nombre} ${apellido}`} />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">
              {fotoKey
                ? 'El alumno tiene una foto de perfil cargada.'
                : 'Aún no hay foto de perfil del alumno.'}
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
                  {fotoKey ? 'Cambiar foto' : 'Subir foto'}
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
