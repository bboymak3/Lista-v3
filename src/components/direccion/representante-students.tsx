'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Users,
  UserPlus,
  Search,
  Loader2,
  GraduationCap,
  Trash2,
  Check,
  ChevronDown,
  X,
  AlertCircle,
  UserCircle,
  MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RepRow {
  id: string
  cedula: string
  nombre: string
  apellido: string
  email: string | null
  telefono: string | null
  whatsapp: string | null
  activo: boolean
  createdAt: string
  studentsCount: number
}

interface StudentOption {
  id: string
  codigoUnico: string
  cedulaEscolar: string | null
  nombre: string
  apellido: string
  section: { id: string; nombre: string; grado: string; turno: string } | null
}

interface AssignedStudent {
  id: string // parent_student.id
  estudianteId: string
  parentesco: string
  esPrincipal: boolean
  createdAt: string
  estudiante: {
    id: string
    codigoUnico: string
    cedulaEscolar: string | null
    nombre: string
    apellido: string
    genero: string | null
    activo: boolean
    section: { id: string; nombre: string; grado: string; turno: string }
  }
}

const parentescoLabels: Record<string, string> = {
  madre: 'Madre',
  padre: 'Padre',
  tutor: 'Tutor/a',
  otro: 'Otro',
}

function initialsOf(nombre: string, apellido: string): string {
  return `${nombre?.[0] || ''}${apellido?.[0] || ''}`.toUpperCase()
}

export function RepresentanteStudents() {
  const [representantes, setRepresentantes] = useState<RepRow[]>([])
  const [loadingReps, setLoadingReps] = useState(true)
  const [repSearch, setRepSearch] = useState('')
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null)

  const [assigned, setAssigned] = useState<AssignedStudent[]>([])
  const [loadingAssigned, setLoadingAssigned] = useState(false)

  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [parentesco, setParentesco] = useState<string>('madre')
  const [esPrincipal, setEsPrincipal] = useState(true)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  // Unlink confirmation
  const [unlinkTarget, setUnlinkTarget] = useState<AssignedStudent | null>(null)
  const [unlinking, setUnlinking] = useState(false)

  const loadRepresentantes = useCallback(async () => {
    setLoadingReps(true)
    try {
      const params = new URLSearchParams()
      params.set('includeInactive', 'true')
      if (repSearch) params.set('search', repSearch)
      const res = await api.get<{ data: RepRow[] }>(
        `/admin/representantes?${params.toString()}`
      )
      const reps = res.data || []
      setRepresentantes(reps)
      // Auto-select first if none selected
      if (!selectedRepId && reps.length > 0) {
        setSelectedRepId(reps[0].id)
      }
    } catch (e: any) {
      toast.error('Error al cargar representantes', { description: e.message })
    } finally {
      setLoadingReps(false)
    }
  }, [repSearch])

  useEffect(() => {
    const t = setTimeout(loadRepresentantes, 250)
    return () => clearTimeout(t)
  }, [loadRepresentantes])

  const loadAssigned = useCallback(async () => {
    if (!selectedRepId) {
      setAssigned([])
      return
    }
    setLoadingAssigned(true)
    try {
      const res = await api.get<{ data: AssignedStudent[] }>(
        `/admin/representantes/${selectedRepId}/students`
      )
      setAssigned(res.data || [])
    } catch (e: any) {
      toast.error('Error al cargar estudiantes asignados', { description: e.message })
      setAssigned([])
    } finally {
      setLoadingAssigned(false)
    }
  }, [selectedRepId])

  useEffect(() => {
    loadAssigned()
  }, [loadAssigned])

  // Load students for the searchable dropdown
  const loadStudentOptions = useCallback(async () => {
    setLoadingStudents(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '200')
      params.set('includeInactive', 'false')
      if (studentSearch) params.set('search', studentSearch)
      const res = await api.get<{ data: StudentOption[] }>(
        `/admin/students?${params.toString()}`
      )
      setStudentOptions(res.data || [])
    } catch (e: any) {
      toast.error('Error al cargar estudiantes', { description: e.message })
    } finally {
      setLoadingStudents(false)
    }
  }, [studentSearch])

  useEffect(() => {
    const t = setTimeout(loadStudentOptions, 250)
    return () => clearTimeout(t)
  }, [loadStudentOptions])

  const selectedRep = useMemo(
    () => representantes.find((r) => r.id === selectedRepId) || null,
    [representantes, selectedRepId]
  )

  const selectedStudent = useMemo(
    () => studentOptions.find((s) => s.id === selectedStudentId) || null,
    [studentOptions, selectedStudentId]
  )

  const openAddDialog = () => {
    setSelectedStudentId('')
    setParentesco('madre')
    setEsPrincipal(true)
    setStudentSearch('')
    setAddDialogOpen(true)
  }

  const handleAssign = async () => {
    if (!selectedRepId || !selectedStudentId || !parentesco) {
      toast.error('Selecciona un estudiante y el parentesco')
      return
    }
    setAdding(true)
    try {
      await api.post(`/admin/representantes/${selectedRepId}/students`, {
        estudianteId: selectedStudentId,
        parentesco,
        esPrincipal,
      })
      toast.success('Estudiante asignado')
      setAddDialogOpen(false)
      loadAssigned()
      // Actualizar contador en la lista de representantes
      setRepresentantes((prev) =>
        prev.map((r) =>
          r.id === selectedRepId
            ? { ...r, studentsCount: r.studentsCount + 1 }
            : r
        )
      )
    } catch (e: any) {
      toast.error(e.message || 'Error al asignar estudiante')
    } finally {
      setAdding(false)
    }
  }

  const handleUnlink = async () => {
    if (!unlinkTarget || !selectedRepId) return
    setUnlinking(true)
    try {
      await api.delete(
        `/admin/representantes/${selectedRepId}/students/${unlinkTarget.estudianteId}`
      )
      toast.success('Estudiante desvinculado')
      setUnlinkTarget(null)
      loadAssigned()
      setRepresentantes((prev) =>
        prev.map((r) =>
          r.id === selectedRepId
            ? { ...r, studentsCount: Math.max(0, r.studentsCount - 1) }
            : r
        )
      )
    } catch (e: any) {
      toast.error(e.message || 'Error al desvincular estudiante')
    } finally {
      setUnlinking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Asignar Representantes</h2>
        <p className="text-sm text-muted-foreground">
          Vincula estudiantes (incluyendo hermanos) a sus representantes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Representatives list */}
        <Card className="lg:self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCircle className="w-4 h-4 text-emerald-600" />
              Representantes
            </CardTitle>
            <div className="relative mt-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar representante..."
                value={repSearch}
                onChange={(e) => setRepSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[60vh] overflow-y-auto px-2 pb-2">
              {loadingReps ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : representantes.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No hay representantes registrados
                </div>
              ) : (
                <ul className="space-y-1">
                  {representantes.map((r) => {
                    const isActive = r.id === selectedRepId
                    return (
                      <li key={r.id}>
                        <button
                          onClick={() => setSelectedRepId(r.id)}
                          className={cn(
                            'w-full text-left flex items-center gap-3 p-2.5 rounded-lg transition-colors',
                            isActive
                              ? 'bg-emerald-100 dark:bg-emerald-950/40 ring-1 ring-emerald-300 dark:ring-emerald-800'
                              : 'hover:bg-accent'
                          )}
                        >
                          <Avatar className="w-9 h-9 shrink-0">
                            <AvatarFallback
                              className={cn(
                                'text-xs font-semibold',
                                isActive
                                  ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {initialsOf(r.nombre, r.apellido)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {r.apellido}, {r.nombre}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {r.cedula}
                              {!r.activo && (
                                <span className="ml-2 text-red-600">• Inactivo</span>
                              )}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              'shrink-0',
                              r.studentsCount > 0
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            <GraduationCap className="w-3 h-3 mr-1" />
                            {r.studentsCount}
                          </Badge>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Assigned students */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                  {selectedRep ? (
                    <>
                      {selectedRep.nombre} {selectedRep.apellido}
                    </>
                  ) : (
                    'Selecciona un representante'
                  )}
                </CardTitle>
                {selectedRep && (
                  <CardDescription className="mt-1">
                    {selectedRep.cedula}
                    {selectedRep.telefono && <> · {selectedRep.telefono}</>}
                    {selectedRep.whatsapp && (
                      <>
                        {' · '}
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <MessageCircle className="w-3 h-3" />
                          {selectedRep.whatsapp}
                        </span>
                      </>
                    )}
                  </CardDescription>
                )}
              </div>
              {selectedRep && (
                <Button
                  onClick={openAddDialog}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  Agregar estudiante
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedRep ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                Selecciona un representante de la lista para ver y gestionar sus estudiantes asignados.
              </div>
            ) : loadingAssigned ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : assigned.length === 0 ? (
              <div className="py-12 text-center">
                <GraduationCap className="w-10 h-10 mx-auto text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Este representante no tiene estudiantes asignados
                </p>
                <Button
                  onClick={openAddDialog}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <UserPlus className="w-4 h-4" />
                  Agregar primer estudiante
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto -mx-2 px-2">
                {assigned.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border bg-card',
                      !a.estudiante.activo && 'opacity-60'
                    )}
                  >
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-xs font-semibold">
                        {initialsOf(a.estudiante.nombre, a.estudiante.apellido)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {a.estudiante.apellido}, {a.estudiante.nombre}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <span className="truncate">{a.estudiante.codigoUnico}</span>
                        {a.estudiante.cedulaEscolar && (
                          <>
                            <span>·</span>
                            <span className="truncate">{a.estudiante.cedulaEscolar}</span>
                          </>
                        )}
                        {a.estudiante.section && (
                          <>
                            <span>·</span>
                            <span className="truncate">{a.estudiante.section.nombre}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge
                        variant="outline"
                        className="bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900"
                      >
                        {parentescoLabels[a.parentesco] || a.parentesco}
                      </Badge>
                      {a.esPrincipal && (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900 text-xs">
                          Principal
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0"
                      onClick={() => setUnlinkTarget(a)}
                      aria-label="Quitar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div className="pt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>
                    {assigned.length} estudiante{assigned.length === 1 ? '' : 's'} asignado
                    {assigned.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Student Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              Asignar estudiante
            </DialogTitle>
            <DialogDescription>
              {selectedRep && (
                <>
                  a <strong className="text-foreground">{selectedRep.nombre} {selectedRep.apellido}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="student-search">Estudiante *</Label>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={popoverOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedStudent ? (
                      <span className="flex items-center gap-2 min-w-0">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[10px] font-semibold">
                            {initialsOf(selectedStudent.nombre, selectedStudent.apellido)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">
                          {selectedStudent.apellido}, {selectedStudent.nombre}
                        </span>
                        {selectedStudent.section && (
                          <span className="text-xs text-muted-foreground truncate">
                            · {selectedStudent.section.nombre}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Buscar estudiante...</span>
                    )}
                    <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar por nombre, código o cédula..."
                      value={studentSearch}
                      onValueChange={setStudentSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {loadingStudents ? 'Cargando...' : 'No se encontraron estudiantes.'}
                      </CommandEmpty>
                      <CommandGroup>
                        {studentOptions.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={`${s.nombre} ${s.apellido} ${s.codigoUnico} ${s.cedulaEscolar || ''}`}
                            onSelect={() => {
                              setSelectedStudentId(s.id)
                              setPopoverOpen(false)
                            }}
                            className="cursor-pointer"
                          >
                            <Avatar className="w-6 h-6 mr-1">
                              <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[10px] font-semibold">
                                {initialsOf(s.nombre, s.apellido)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">
                                {s.apellido}, {s.nombre}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {s.codigoUnico}
                                {s.section && ` · ${s.section.nombre}`}
                              </p>
                            </div>
                            {s.id === selectedStudentId && (
                              <Check className="w-4 h-4 text-emerald-600" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="parentesco">Parentesco *</Label>
                <Select value={parentesco} onValueChange={setParentesco}>
                  <SelectTrigger id="parentesco" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="madre">Madre</SelectItem>
                    <SelectItem value="padre">Padre</SelectItem>
                    <SelectItem value="tutor">Tutor/a</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Principal</Label>
                <div className="flex items-center gap-2 h-9">
                  <Checkbox
                    id="es-principal"
                    checked={esPrincipal}
                    onCheckedChange={(v) => setEsPrincipal(v === true)}
                  />
                  <label htmlFor="es-principal" className="text-sm cursor-pointer">
                    Representante principal
                  </label>
                </div>
              </div>
            </div>

            {esPrincipal && (
              <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Si este estudiante ya tenía otro representante principal, será reemplazado.
                  Un alumno puede tener varios representantes, pero solo uno como principal.
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleAssign}
              disabled={adding || !selectedStudentId}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {adding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Asignar estudiante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink confirmation */}
      <AlertDialog
        open={!!unlinkTarget}
        onOpenChange={(open) => !open && setUnlinkTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desvincular estudiante?</AlertDialogTitle>
            <AlertDialogDescription>
              El estudiante{' '}
              <strong>
                {unlinkTarget?.estudiante.nombre} {unlinkTarget?.estudiante.apellido}
              </strong>{' '}
              será desvinculado de{' '}
              <strong>
                {selectedRep?.nombre} {selectedRep?.apellido}
              </strong>
              . El estudiante seguirá registrado, solo se elimina la asociación con este representante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlink}
              disabled={unlinking}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {unlinking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
