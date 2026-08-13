'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  Pencil,
  Trash2,
  School,
  Loader2,
  Users,
  UserCircle,
} from 'lucide-react'

interface PlantelOption {
  id: string
  nombre: string
}

interface TutorOption {
  id: string
  nombre: string
  apellido: string
  cedula: string
}

interface SectionRow {
  id: string
  nombre: string
  grado: string
  turno: string
  plantelId: string
  plantel: { id: string; nombre: string } | null
  tutorId: string | null
  tutor: { id: string; nombre: string; apellido: string; cedula: string } | null
  periodoEscolar: string
  activa: boolean
  studentCount: number
}

const turnoLabel: Record<string, string> = {
  manana: 'Mañana',
  tarde: 'Tarde',
  nocturno: 'Nocturno',
}

interface SectionFormValues {
  nombre: string
  grado: string
  turno: string
  plantelId: string
  tutorId: string
}

function emptyForm(plantelDefault = '', gradoDefault = '1'): SectionFormValues {
  return {
    nombre: '',
    grado: gradoDefault,
    turno: 'manana',
    plantelId: plantelDefault,
    tutorId: '',
  }
}

const grados = ['1', '2', '3', '4', '5']

export function SectionsManager() {
  const [sections, setSections] = useState<SectionRow[]>([])
  const [plantels, setPlantels] = useState<PlantelOption[]>([])
  const [tutors, setTutors] = useState<TutorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SectionRow | null>(null)
  const [form, setForm] = useState<SectionFormValues>(emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SectionRow | null>(null)

  const loadPlantels = useCallback(async () => {
    try {
      const res = await api.get<{ data: PlantelOption[] }>('/admin/plantels')
      setPlantels(res.data || [])
    } catch (e: any) {
      toast.error('Error al cargar planteles', { description: e.message })
    }
  }, [])

  const loadTutors = useCallback(async () => {
    try {
      const res = await api.get<{ data: TutorOption[] }>('/admin/users?rol=profesor&includeInactive=false')
      setTutors(res.data || [])
    } catch (e: any) {
      // sin profesores registrados no es error fatal
      setTutors([])
    }
  }, [])

  const loadSections = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ data: SectionRow[] }>('/admin/sections?includeInactive=true')
      setSections(res.data || [])
    } catch (e: any) {
      toast.error('Error al cargar secciones', { description: e.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPlantels()
    loadTutors()
  }, [loadPlantels, loadTutors])

  useEffect(() => {
    loadSections()
  }, [loadSections])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm(plantels[0]?.id || ''))
    setDialogOpen(true)
  }

  const openEdit = (s: SectionRow) => {
    setEditing(s)
    setForm({
      nombre: s.nombre,
      grado: s.grado,
      turno: s.turno,
      plantelId: s.plantelId,
      tutorId: s.tutorId || '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre || !form.grado || !form.turno || !form.plantelId) {
      toast.error('Completa todos los campos obligatorios')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        nombre: form.nombre,
        grado: form.grado,
        turno: form.turno,
        plantelId: form.plantelId,
        tutorId: form.tutorId || null,
      }
      if (editing) {
        await api.put(`/admin/sections/${editing.id}`, payload)
        toast.success('Sección actualizada')
      } else {
        await api.post('/admin/sections', payload)
        toast.success('Sección creada')
      }
      setDialogOpen(false)
      loadSections()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar sección')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/admin/sections/${deleteTarget.id}`)
      toast.success('Sección desactivada')
      setDeleteTarget(null)
      loadSections()
    } catch (e: any) {
      toast.error(e.message || 'Error al desactivar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Secciones</h2>
          <p className="text-sm text-muted-foreground">
            Grados y grupos del plantel — asigna tutores a cada sección
          </p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4" />
          Crear sección
        </Button>
      </div>

      {plantels.length === 0 && !loading && (
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="py-4 text-sm text-amber-800 dark:text-amber-300">
            No hay planteles registrados. Crea al menos un plantel en la sección Geocerca antes de
            crear secciones.
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-24 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <School className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">No hay secciones registradas</p>
            <Button
              onClick={openCreate}
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="w-4 h-4" />
              Crear primera sección
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <Card
              key={s.id}
              className={!s.activa ? 'opacity-60' : ''}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <span className="truncate">{s.nombre}</span>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {s.plantel?.nombre || '—'}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 shrink-0"
                  >
                    {turnoLabel[s.turno] || s.turno}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Grado</p>
                    <p className="font-medium">{s.grado}°</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Periodo</p>
                    <p className="font-medium">{s.periodoEscolar}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <UserCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Tutor:</span>
                    <span className="font-medium truncate">
                      {s.tutor
                        ? `${s.tutor.nombre} ${s.tutor.apellido}`
                        : 'Sin asignar'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Estudiantes:</span>
                    <span className="font-medium">{s.studentCount}</span>
                  </div>
                </div>
                {!s.activa && (
                  <Badge variant="secondary" className="text-xs">
                    Inactiva
                  </Badge>
                )}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => openEdit(s)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                    onClick={() => setDeleteTarget(s)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar sección' : 'Nueva sección'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Modifica los datos de la sección o reasigna el tutor.'
                : 'Crea una nueva sección/grupo dentro de un plantel.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre de la sección *</Label>
              <Input
                id="nombre"
                placeholder="Ej: 1° A"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="grado">Grado *</Label>
                <Select
                  value={form.grado}
                  onValueChange={(v) => setForm({ ...form, grado: v })}
                >
                  <SelectTrigger id="grado" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {grados.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}°
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="turno">Turno *</Label>
                <Select
                  value={form.turno}
                  onValueChange={(v) => setForm({ ...form, turno: v })}
                >
                  <SelectTrigger id="turno" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manana">Mañana</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="nocturno">Nocturno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plantelId">Plantel *</Label>
              <Select
                value={form.plantelId}
                onValueChange={(v) => setForm({ ...form, plantelId: v })}
              >
                <SelectTrigger id="plantelId" className="w-full">
                  <SelectValue placeholder="Selecciona un plantel" />
                </SelectTrigger>
                <SelectContent>
                  {plantels.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tutorId">Tutor (profesor)</Label>
              <Select
                value={form.tutorId}
                onValueChange={(v) => setForm({ ...form, tutorId: v })}
              >
                <SelectTrigger id="tutorId" className="w-full">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin asignar</SelectItem>
                  {tutors.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nombre} {t.apellido} · {t.cedula}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editing ? 'Guardar cambios' : 'Crear sección'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar sección?</AlertDialogTitle>
            <AlertDialogDescription>
              La sección <strong>{deleteTarget?.nombre}</strong> será marcada como inactiva.
              Los estudiantes asignados mantendrán su registro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
