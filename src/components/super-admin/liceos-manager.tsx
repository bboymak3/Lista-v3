'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { useViewStore } from '@/stores/view-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, School, Pencil, Trash2, Users, GraduationCap, MapPin, Phone, Mail, Camera, Loader2, Building } from 'lucide-react'
import { toast } from 'sonner'

interface Plantel {
  id: string
  nombre: string
  descripcion: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  lat: number
  lng: number
  radioM: number
  logoKey: string | null
  periodoActual: string
  activo: boolean
  sectionsCount: number
  studentsCount: number
  usersCount: number
}

export function LiceosManager() {
  const setActiveView = useViewStore((s) => s.setActiveView)
  const [plantels, setPlantels] = useState<Plantel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Plantel | null>(null)
  const [deleting, setDeleting] = useState<Plantel | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<{ plantels: Plantel[] }>('/super-admin/plantels')
      setPlantels(data.plantels)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = plantels.filter(p => {
    if (!p.activo && !showInactive) return false
    if (search && !p.nombre.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleSelect = (p: Plantel) => {
    // Guardar el liceo seleccionado y navegar al detalle
    localStorage.setItem('selectedPlantelId', p.id)
    localStorage.setItem('selectedPlantelName', p.nombre)
    setActiveView('super-admin-liceo-detail')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building className="w-6 h-6 text-emerald-600" />
            Liceos
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Gestiona todos los liceos del sistema</p>
        </div>
        <CreatePlantelDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Buscar liceo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant={showInactive ? 'default' : 'outline'}
          onClick={() => setShowInactive(!showInactive)}
          size="sm"
        >
          {showInactive ? 'Todos' : 'Mostrar inactivos'}
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <School className="w-12 h-12 mx-auto mb-2 opacity-40" />
          No hay liceos {showInactive ? '' : 'activos'}. Crea el primero.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {p.logoKey ? (
                      <img src={`/api/files/${p.logoKey}`} alt={p.nombre} className="w-12 h-12 rounded-lg object-cover border" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                        <School className="w-6 h-6 text-emerald-600" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{p.nombre}</CardTitle>
                      {!p.activo && <Badge variant="secondary">Inactivo</Badge>}
                    </div>
                  </div>
                </div>
                {p.descripcion && (
                  <CardDescription className="line-clamp-2 mt-1">{p.descripcion}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <div className="text-lg font-bold text-emerald-600">{p.sectionsCount}</div>
                    <div className="text-xs text-muted-foreground">Secciones</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <div className="text-lg font-bold text-emerald-600">{p.studentsCount}</div>
                    <div className="text-xs text-muted-foreground">Estudiantes</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <div className="text-lg font-bold text-emerald-600">{p.usersCount}</div>
                    <div className="text-xs text-muted-foreground">Usuarios</div>
                  </div>
                </div>
                {p.direccion && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" /> {p.direccion}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleSelect(p)}>
                    Ver detalle
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeleting(p)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      {editing && (
        <CreatePlantelDialog
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          onCreated={load}
          plantel={editing}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar {deleting?.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              El liceo se marcará como inactivo. Podrás reactivarlo cuando quieras.
              Los datos no se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                try {
                  await api.delete(`/super-admin/plantels/${deleting!.id}`)
                  toast.success('Liceo desactivado')
                  setDeleting(null)
                  load()
                } catch (e: any) { toast.error(e.message) }
              }}
            >
              Sí, desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CreatePlantelDialog({
  open, onOpenChange, onCreated, plantel
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
  plantel?: Plantel
}) {
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [logoKey, setLogoKey] = useState<string | null>(plantel?.logoKey || null)
  const [form, setForm] = useState({
    nombre: plantel?.nombre || '',
    descripcion: plantel?.descripcion || '',
    direccion: plantel?.direccion || '',
    telefono: plantel?.telefono || '',
    email: plantel?.email || '',
    lat: plantel?.lat || 0,
    lng: plantel?.lng || 0,
    radioM: plantel?.radioM || 150,
  })

  const handleLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = (await import('@/stores/auth-store')).useAuthStore.getState().token
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLogoKey(data.mediaKey)
      toast.success('Logo cargado')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.nombre) { toast.error('Nombre requerido'); return }
    if (!form.lat || !form.lng) { toast.error('Lat y Lng requeridas (usa Google Maps)'); return }
    setSaving(true)
    try {
      const body = { ...form, lat: Number(form.lat), lng: Number(form.lng), radioM: Number(form.radioM), logoKey }
      if (plantel) {
        await api.put(`/super-admin/plantels/${plantel.id}`, body)
        toast.success('Liceo actualizado')
      } else {
        await api.post('/super-admin/plantels', body)
        toast.success('Liceo creado')
      }
      onOpenChange(false)
      onCreated()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" /> Crear Liceo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plantel ? 'Editar Liceo' : 'Nuevo Liceo'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            {logoKey ? (
              <img src={`/api/files/${logoKey}`} alt="Logo" className="w-16 h-16 rounded-lg object-cover border" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                <School className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <div>
              <Label htmlFor="logo-input" className="cursor-pointer">
                <Button variant="outline" size="sm" asChild disabled={uploading}>
                  <span>
                    {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo...</> : <><Camera className="w-4 h-4 mr-2" /> Subir logo</>}
                  </span>
                </Button>
              </Label>
              <Input id="logo-input" type="file" accept="image/*" className="hidden" onChange={handleLogo} />
              <p className="text-xs text-muted-foreground mt-1">Aparece en los carnets de estudiantes</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre del liceo *</Label>
              <Input value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} placeholder="Liceo..." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={(e) => setForm({...form, descripcion: e.target.value})} placeholder="Breve descripción del liceo..." />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Dirección</Label>
              <Input value={form.direccion} onChange={(e) => setForm({...form, direccion: e.target.value})} placeholder="Dirección física" />
            </div>
            <div className="space-y-2">
              <Label><Phone className="w-3 h-3 inline mr-1" /> Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({...form, telefono: e.target.value})} placeholder="0212-0000000" />
            </div>
            <div className="space-y-2">
              <Label><Mail className="w-3 h-3 inline mr-1" /> Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="correo@liceo.edu" />
            </div>
            <div className="space-y-2">
              <Label>Latitud *</Label>
              <Input type="number" step="any" value={form.lat} onChange={(e) => setForm({...form, lat: parseFloat(e.target.value)})} placeholder="10.4806" />
            </div>
            <div className="space-y-2">
              <Label>Longitud *</Label>
              <Input type="number" step="any" value={form.lng} onChange={(e) => setForm({...form, lng: parseFloat(e.target.value)})} placeholder="-66.9036" />
            </div>
            <div className="space-y-2">
              <Label>Radio de geocerca (metros)</Label>
              <Input type="number" value={form.radioM} onChange={(e) => setForm({...form, radioM: parseInt(e.target.value)})} placeholder="150" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Obtén las coordenadas desde Google Maps (click derecho → coordenadas)
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</> : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
