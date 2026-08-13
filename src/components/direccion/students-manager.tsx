'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  DialogTrigger,
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
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, Pencil, Trash2, GraduationCap, Loader2, Users } from 'lucide-react'

interface SectionOption {
  id: string
  nombre: string
  grado: string
  turno: string
}

interface StudentRow {
  id: string
  codigoUnico: string
  cedulaEscolar: string | null
  nombre: string
  apellido: string
  fechaNacimiento: string | null
  genero: string | null
  sectionId: string
  section: { id: string; nombre: string; grado: string; turno: string } | null
  activo: boolean
}

interface StudentsResponse {
  data: StudentRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const turnoLabel: Record<string, string> = {
  manana: 'Mañana',
  tarde: 'Tarde',
  nocturno: 'Nocturno',
}

const generoLabel: Record<string, string> = {
  M: 'Masculino',
  F: 'Femenino',
  O: 'Otro',
}

function generateCodigoUnico() {
  // Codigo único basado en timestamp + random
  return `EST-${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`
}

interface StudentFormValues {
  nombre: string
  apellido: string
  cedulaEscolar: string
  sectionId: string
  genero: string
  fechaNacimiento: string
}

function emptyForm(sectionDefault = ''): StudentFormValues {
  return {
    nombre: '',
    apellido: '',
    cedulaEscolar: '',
    sectionId: sectionDefault,
    genero: '',
    fechaNacimiento: '',
  }
}

export function StudentsManager() {
  const [students, setStudents] = useState<StudentRow[]>([])
  const [sections, setSections] = useState<SectionOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sectionFilter, setSectionFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StudentRow | null>(null)
  const [form, setForm] = useState<StudentFormValues>(emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadSections = useCallback(async () => {
    try {
      const res = await api.get<{ data: SectionOption[] }>('/admin/sections')
      setSections(res.data || [])
    } catch (e: any) {
      toast.error('Error al cargar secciones', { description: e.message })
    }
  }, [])

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '100')
      if (search) params.set('search', search)
      if (sectionFilter !== 'all') params.set('sectionId', sectionFilter)
      params.set('includeInactive', 'true')
      const res = await api.get<StudentsResponse>(`/admin/students?${params.toString()}`)
      setStudents(res.data || [])
    } catch (e: any) {
      toast.error('Error al cargar estudiantes', { description: e.message })
    } finally {
      setLoading(false)
    }
  }, [search, sectionFilter])

  useEffect(() => {
    loadSections()
  }, [loadSections])

  useEffect(() => {
    const t = setTimeout(loadStudents, 250)
    return () => clearTimeout(t)
  }, [loadStudents])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm(sections[0]?.id || ''))
    setDialogOpen(true)
  }

  const openEdit = (s: StudentRow) => {
    setEditing(s)
    setForm({
      nombre: s.nombre,
      apellido: s.apellido,
      cedulaEscolar: s.cedulaEscolar || '',
      sectionId: s.sectionId,
      genero: s.genero || '',
      fechaNacimiento: s.fechaNacimiento || '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre || !form.apellido || !form.sectionId) {
      toast.error('Nombre, apellido y sección son obligatorios')
      return
    }
    setSubmitting(true)
    try {
      if (editing) {
        await api.put(`/admin/students/${editing.id}`, {
          nombre: form.nombre,
          apellido: form.apellido,
          cedulaEscolar: form.cedulaEscolar || null,
          sectionId: form.sectionId,
          genero: form.genero || null,
          fechaNacimiento: form.fechaNacimiento || null,
        })
        toast.success('Estudiante actualizado')
      } else {
        await api.post('/admin/students', {
          codigoUnico: generateCodigoUnico(),
          nombre: form.nombre,
          apellido: form.apellido,
          cedulaEscolar: form.cedulaEscolar || null,
          sectionId: form.sectionId,
          genero: form.genero || null,
          fechaNacimiento: form.fechaNacimiento || null,
        })
        toast.success('Estudiante creado')
      }
      setDialogOpen(false)
      loadStudents()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar estudiante')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/admin/students/${deleteTarget.id}`)
      toast.success('Estudiante desactivado')
      setDeleteTarget(null)
      loadStudents()
    } catch (e: any) {
      toast.error(e.message || 'Error al desactivar')
    }
  }

  const handleToggleActivo = async (s: StudentRow) => {
    setTogglingId(s.id)
    try {
      await api.put(`/admin/students/${s.id}`, { activo: !s.activo })
      setStudents((prev) =>
        prev.map((row) => (row.id === s.id ? { ...row, activo: !row.activo } : row))
      )
      toast.success(s.activo ? 'Estudiante desactivado' : 'Estudiante activado')
    } catch (e: any) {
      toast.error(e.message || 'Error al cambiar estado')
    } finally {
      setTogglingId(null)
    }
  }

  const sectionName = useMemo(() => {
    const map = new Map(sections.map((s) => [s.id, s]))
    return (id: string) => {
      const s = map.get(id)
      return s ? `${s.nombre} · ${turnoLabel[s.turno] || s.turno}` : '—'
    }
  }, [sections])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Estudiantes</h2>
          <p className="text-sm text-muted-foreground">
            Gestiona el registro de estudiantes del plantel
          </p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4" />
          Agregar estudiante
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todas las secciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las secciones</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nombre} · {turnoLabel[s.turno] || s.turno}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="py-12 text-center">
              <GraduationCap className="w-10 h-10 mx-auto text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                No hay estudiantes registrados
              </p>
              <p className="text-xs text-muted-foreground">
                Comienza agregando un estudiante o ajusta los filtros
              </p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto -mx-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudiante</TableHead>
                    <TableHead className="hidden md:table-cell">Cédula escolar</TableHead>
                    <TableHead>Sección</TableHead>
                    <TableHead className="hidden sm:table-cell">Género</TableHead>
                    <TableHead className="text-center">Activo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s) => (
                    <TableRow key={s.id} className={!s.activo ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center text-xs font-semibold shrink-0">
                            {s.nombre[0]?.toUpperCase()}
                            {s.apellido[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {s.apellido}, {s.nombre}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {s.codigoUnico}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">{s.cedulaEscolar || '—'}</span>
                      </TableCell>
                      <TableCell>
                        {s.section ? (
                          <Badge variant="outline" className="font-normal">
                            {sectionName(s.section.id)}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {s.genero ? generoLabel[s.genero] || s.genero : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={s.activo}
                          onCheckedChange={() => handleToggleActivo(s)}
                          disabled={togglingId === s.id}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(s)}
                            aria-label="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                            onClick={() => setDeleteTarget(s)}
                            aria-label="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && students.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>{students.length} estudiante(s) mostrado(s)</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar estudiante' : 'Nuevo estudiante'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Actualiza los datos del estudiante seleccionado.'
                : 'Completa el formulario para registrar un nuevo estudiante.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellido">Apellido *</Label>
                <Input
                  id="apellido"
                  value={form.apellido}
                  onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cedulaEscolar">Cédula escolar</Label>
              <Input
                id="cedulaEscolar"
                value={form.cedulaEscolar}
                onChange={(e) => setForm({ ...form, cedulaEscolar: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sectionId">Sección *</Label>
              <Select
                value={form.sectionId}
                onValueChange={(v) => setForm({ ...form, sectionId: v })}
              >
                <SelectTrigger id="sectionId" className="w-full">
                  <SelectValue placeholder="Selecciona una sección" />
                </SelectTrigger>
                <SelectContent>
                  {sections.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Crea una sección primero
                    </div>
                  ) : (
                    sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre} · {turnoLabel[s.turno] || s.turno} (Grado {s.grado})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="genero">Género</Label>
                <Select
                  value={form.genero}
                  onValueChange={(v) => setForm({ ...form, genero: v })}
                >
                  <SelectTrigger id="genero" className="w-full">
                    <SelectValue placeholder="Sin especificar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Femenino</SelectItem>
                    <SelectItem value="O">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
                <Input
                  id="fechaNacimiento"
                  type="date"
                  value={form.fechaNacimiento}
                  onChange={(e) => setForm({ ...form, fechaNacimiento: e.target.value })}
                />
              </div>
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
                {editing ? 'Guardar cambios' : 'Crear estudiante'}
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
            <AlertDialogTitle>¿Desactivar estudiante?</AlertDialogTitle>
            <AlertDialogDescription>
              El estudiante <strong>{deleteTarget?.nombre} {deleteTarget?.apellido}</strong> será
              marcado como inactivo. Podrás reactivarlo más adelante si es necesario.
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
