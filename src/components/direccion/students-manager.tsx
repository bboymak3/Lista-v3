'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth-store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  GraduationCap,
  Loader2,
  Users,
  FileText,
  Camera,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Download,
} from 'lucide-react'

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
  fotoKey: string | null
  qrCode?: string
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
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Photo upload (in edit dialog)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Edit double confirmation
  const [confirmEditOpen, setConfirmEditOpen] = useState(false)

  // Delete double confirmation
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleteStep2, setDeleteStep2] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Carnet PDF loading
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null)

  // Monthly attendance PDF dialog
  const [attendancePdfTarget, setAttendancePdfTarget] = useState<StudentRow | null>(null)
  const todayForMonth = new Date()
  const defaultMonth = `${todayForMonth.getFullYear()}-${String(
    todayForMonth.getMonth() + 1
  ).padStart(2, '0')}`
  const [attendanceMonth, setAttendanceMonth] = useState(defaultMonth)

  const openAttendancePdf = async (s: StudentRow) => {
    if (!attendanceMonth || !/^\d{4}-\d{2}$/.test(attendanceMonth)) {
      toast.error('Selecciona un mes válido (YYYY-MM)')
      return
    }
    setPdfLoadingId(s.id)
    try {
      const { useAuthStore } = await import('@/stores/auth-store')
      const token = useAuthStore.getState().token
      const url = `/api/admin/students/${s.id}/attendance-pdf?month=${attendanceMonth}${
        token ? `&token=${encodeURIComponent(token)}` : ''
      }`
      window.open(url, '_blank', 'noopener,noreferrer')
      setAttendancePdfTarget(null)
      toast.success('Generando reporte de asistencia…')
    } catch (e: any) {
      toast.error('No se pudo generar el reporte: ' + (e.message || ''))
    } finally {
      setTimeout(() => setPdfLoadingId(null), 800)
    }
  }

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

  const resetPhotoState = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    setUploadingPhoto(false)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm(sections[0]?.id || ''))
    resetPhotoState()
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
    resetPhotoState()
    setPhotoPreview(s.fotoKey ? `/api/files/${s.fotoKey}` : null)
    setDialogOpen(true)
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setPhotoFile(file)
    const url = URL.createObjectURL(file)
    setPhotoPreview(url)
  }

  // Step 1 of edit: validate form → open second confirmation dialog
  const handleSubmitClick = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre || !form.apellido || !form.sectionId) {
      toast.error('Nombre, apellido y sección son obligatorios')
      return
    }
    setConfirmEditOpen(true)
  }

  // Step 2 of edit: actually save (after second confirmation)
  const performSave = async () => {
    setSubmitting(true)
    try {
      // 1. If a new photo was selected, upload it first
      let newFotoKey: string | null = null
      if (photoFile && editing) {
        setUploadingPhoto(true)
        try {
          const token = useAuthStore.getState().token
          const formData = new FormData()
          formData.append('file', photoFile)
          formData.append('estudianteId', editing.id)
          // Use plain fetch (NOT apiFetch) so the browser sets the correct
          // multipart/form-data Content-Type automatically with the boundary.
          const uploadRes = await fetch('/api/alumno/photo', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          })
          if (!uploadRes.ok) {
            const errBody = await uploadRes.json().catch(() => ({}))
            throw new Error((errBody as any).error || `HTTP ${uploadRes.status}`)
          }
          const data = (await uploadRes.json()) as { mediaKey: string }
          newFotoKey = data.mediaKey
        } catch (err: any) {
          toast.error('No se pudo subir la foto: ' + err.message)
          setSubmitting(false)
          setUploadingPhoto(false)
          return
        } finally {
          setUploadingPhoto(false)
        }
      }

      // 2. PUT the student data
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

      // If photo uploaded for a brand-new student, we'd need the created id — for now only edit supports photo upload (per spec)
      if (newFotoKey) {
        toast.success('Foto actualizada')
      }

      setConfirmEditOpen(false)
      setDialogOpen(false)
      resetPhotoState()
      loadStudents()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar estudiante')
    } finally {
      setSubmitting(false)
    }
  }

  // === Delete flow (double confirmation) ===
  const openDeleteStep1 = (s: StudentRow) => {
    setDeleteTarget(s)
    setDeleteConfirmName('')
    setDeleteStep2(false)
  }

  const advanceToDeleteStep2 = () => {
    setDeleteStep2(true)
    setDeleteConfirmName('')
  }

  const cancelDelete = () => {
    setDeleteTarget(null)
    setDeleteStep2(false)
    setDeleteConfirmName('')
  }

  const performDelete = async () => {
    if (!deleteTarget) return
    const expected = `${deleteTarget.nombre} ${deleteTarget.apellido}`.trim().toLowerCase()
    if (deleteConfirmName.trim().toLowerCase() !== expected) {
      toast.error('El nombre no coincide')
      return
    }
    setDeleting(true)
    try {
      await api.delete(`/admin/students/${deleteTarget.id}`)
      toast.success('Estudiante eliminado')
      cancelDelete()
      loadStudents()
    } catch (e: any) {
      toast.error(e.message || 'Error al eliminar')
    } finally {
      setDeleting(false)
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

  // === Carnet PDF download ===
  const openCarnetPdf = (s: StudentRow) => {
    setPdfLoadingId(s.id)
    try {
      const token = useAuthStore.getState().token
      const url = `/api/admin/students/${s.id}/carnet-pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e: any) {
      toast.error('No se pudo generar el carnet PDF: ' + (e.message || ''))
    } finally {
      setTimeout(() => setPdfLoadingId(null), 800)
    }
  }

  const sectionName = useMemo(() => {
    const map = new Map(sections.map((s) => [s.id, s]))
    return (id: string) => {
      const s = map.get(id)
      return s ? `${s.nombre} · ${turnoLabel[s.turno] || s.turno}` : '—'
    }
  }, [sections])

  const initialsOf = (s: StudentRow) =>
    `${s.nombre?.[0] || ''}${s.apellido?.[0] || ''}`.toUpperCase()

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
                          <Avatar className="w-9 h-9 border border-emerald-100 dark:border-emerald-950 shrink-0">
                            {s.fotoKey ? (
                              <AvatarImage
                                src={`/api/files/${s.fotoKey}`}
                                alt={`${s.nombre} ${s.apellido}`}
                              />
                            ) : null}
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-xs font-semibold">
                              {initialsOf(s)}
                            </AvatarFallback>
                          </Avatar>
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
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openCarnetPdf(s)}
                            disabled={pdfLoadingId === s.id}
                            aria-label="Generar Carnet PDF"
                            title="Generar Carnet PDF"
                            className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                          >
                            {pdfLoadingId === s.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setAttendancePdfTarget(s)
                            }}
                            disabled={pdfLoadingId === s.id}
                            aria-label="Reporte Asistencia PDF"
                            title="Reporte Asistencia PDF"
                            className="text-teal-700 hover:text-teal-800 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/40"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                            onClick={() => openDeleteStep1(s)}
                            aria-label="Eliminar"
                            title="Eliminar"
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
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetPhotoState()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar estudiante' : 'Nuevo estudiante'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Actualiza los datos del estudiante seleccionado.'
                : 'Completa el formulario para registrar un nuevo estudiante.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitClick} className="space-y-4">
            {/* Photo upload (only when editing) */}
            {editing && (
              <div className="flex items-center gap-4 pb-3 border-b">
                <Avatar className="w-20 h-20 border-2 border-emerald-100 dark:border-emerald-950">
                  {photoPreview ? (
                    <AvatarImage src={photoPreview} alt="Foto del estudiante" />
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl font-bold">
                    {`${form.nombre?.[0] || ''}${form.apellido?.[0] || ''}`.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-muted-foreground">Foto del estudiante</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    {photoFile ? 'Nueva foto seleccionada' : editing.fotoKey ? 'Foto actual' : 'Sin foto'}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                    >
                      {uploadingPhoto ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          Subiendo…
                        </>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5 mr-1" />
                          {editing.fotoKey ? 'Cambiar foto' : 'Subir foto'}
                        </>
                      )}
                    </Button>
                    {photoFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPhotoFile(null)
                          setPhotoPreview(editing.fotoKey ? `/api/files/${editing.fotoKey}` : null)
                          if (photoInputRef.current) photoInputRef.current.value = ''
                        }}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </div>
              </div>
            )}

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

      {/* Edit double-confirmation dialog */}
      <AlertDialog
        open={confirmEditOpen}
        onOpenChange={(open) => {
          if (!submitting) setConfirmEditOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ¿Confirmas que los datos son correctos?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a {editing ? 'actualizar' : 'crear'} el estudiante{' '}
              <strong>
                {form.nombre} {form.apellido}
              </strong>
              {form.cedulaEscolar ? (
                <>
                  {' '}— cédula escolar <strong>{form.cedulaEscolar}</strong>
                </>
              ) : null}
              . Revisa cuidadosamente antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>No, revisar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                performSave()
              }}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando…
                </>
              ) : (
                'Sí, guardar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete step 1 confirmation */}
      <AlertDialog
        open={!!deleteTarget && !deleteStep2}
        onOpenChange={(open) => {
          if (!open && !deleting) cancelDelete()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              ¿Eliminar a {deleteTarget?.nombre} {deleteTarget?.apellido}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              El estudiante será desactivado en el sistema. Esta acción se puede revertir
              reactivándolo desde la lista. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                advanceToDeleteStep2()
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete step 2 — type the name to confirm */}
      <AlertDialog
        open={!!deleteTarget && deleteStep2}
        onOpenChange={(open) => {
          if (!open && !deleting) cancelDelete()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Esta acción no se puede deshacer
            </AlertDialogTitle>
            <AlertDialogDescription>
              Para confirmar, escribe el nombre completo del estudiante tal como aparece:
              <br />
              <code className="block mt-2 px-2 py-1 rounded bg-muted text-foreground font-mono text-xs">
                {deleteTarget?.nombre} {deleteTarget?.apellido}
              </code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              placeholder="Escribe el nombre completo aquí"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              disabled={deleting}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (
                    deleteConfirmName.trim().toLowerCase() ===
                    `${deleteTarget?.nombre} ${deleteTarget?.apellido}`.trim().toLowerCase()
                  ) {
                    performDelete()
                  }
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {deleteConfirmName.trim().toLowerCase() ===
              `${deleteTarget?.nombre} ${deleteTarget?.apellido}`.trim().toLowerCase()
                ? '✓ El nombre coincide. Puedes eliminar.'
                : 'El nombre debe coincidir exactamente para habilitar la eliminación.'}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                performDelete()
              }}
              disabled={
                deleting ||
                deleteConfirmName.trim().toLowerCase() !==
                  `${deleteTarget?.nombre} ${deleteTarget?.apellido}`.trim().toLowerCase()
              }
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando…
                </>
              ) : (
                'Eliminar definitivamente'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Monthly attendance PDF dialog */}
      <Dialog
        open={!!attendancePdfTarget}
        onOpenChange={(open) => {
          if (!open) setAttendancePdfTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-teal-600" />
              Reporte de Asistencia Mensual
            </DialogTitle>
            <DialogDescription>
              Estudiante:{' '}
              <strong>
                {attendancePdfTarget?.nombre} {attendancePdfTarget?.apellido}
              </strong>
              . Selecciona el mes del reporte que deseas generar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="attendance-month">Mes del reporte</Label>
              <Input
                id="attendance-month"
                type="month"
                value={attendanceMonth}
                onChange={(e) => setAttendanceMonth(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                El PDF se abrirá en una nueva pestaña. Incluye estadísticas,
                detalle diario y líneas de firma.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAttendancePdfTarget(null)}
              disabled={!!pdfLoadingId}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => attendancePdfTarget && openAttendancePdf(attendancePdfTarget)}
              disabled={!attendancePdfTarget || !attendanceMonth || !!pdfLoadingId}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {pdfLoadingId === attendancePdfTarget?.id ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Generar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
