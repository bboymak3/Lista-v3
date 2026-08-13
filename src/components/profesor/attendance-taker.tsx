'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  ClipboardCheck,
  Save,
  Lock,
  Check,
  X,
  Clock,
  FileCheck,
  Users,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SectionItem {
  id: string
  nombre: string
  grado: string
  turno: string
  plantel: string
  rol: string
  studentCount: number
}

interface Student {
  id: string
  codigoUnico: string
  cedulaEscolar: string | null
  nombre: string
  apellido: string
  genero: string | null
}

type Estado = 'presente' | 'ausente' | 'tardanza' | 'justificado'

interface SessionData {
  session: {
    id: string
    estado: string
    fecha: string
    registros: Array<{
      id: string
      estudianteId: string
      estado: Estado
      observacion: string | null
      estudiante: {
        id: string
        nombre: string
        apellido: string
        cedulaEscolar: string | null
        codigoUnico: string
      }
    }>
  } | null
}

const estados: { value: Estado; label: string; color: string; icon: React.ReactNode }[] = [
  {
    value: 'presente',
    label: 'Presente',
    color: 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600',
    icon: <Check className="w-4 h-4" />,
  },
  {
    value: 'ausente',
    label: 'Ausente',
    color: 'bg-red-500 hover:bg-red-600 text-white border-red-600',
    icon: <X className="w-4 h-4" />,
  },
  {
    value: 'tardanza',
    label: 'Tardanza',
    color: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600',
    icon: <Clock className="w-4 h-4" />,
  },
  {
    value: 'justificado',
    label: 'Justificado',
    color: 'bg-sky-500 hover:bg-sky-600 text-white border-sky-600',
    icon: <FileCheck className="w-4 h-4" />,
  },
]

export function AttendanceTaker() {
  const [sections, setSections] = useState<SectionItem[]>([])
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [students, setStudents] = useState<Student[]>([])
  const [asistencia, setAsistencia] = useState<Record<string, Estado>>({})
  const [sessionState, setSessionState] = useState<SessionData['session'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)

  // Cargar secciones
  useEffect(() => {
    api
      .get<{ sections: SectionItem[] }>('/profesor/sections')
      .then((data) => {
        setSections(data.sections)
        if (data.sections[0]) setSelectedSection(data.sections[0].id)
      })
      .catch((e) => toast.error('Error: ' + e.message))
      .finally(() => setLoading(false))
  }, [])

  // Cargar estudiantes + sesión cuando cambia la sección
  const loadSection = useCallback(async (sectionId: string) => {
    if (!sectionId) return
    setLoadingStudents(true)
    try {
      const [stud, sess] = await Promise.all([
        api.get<{ students: Student[] }>(`/profesor/students?sectionId=${sectionId}`),
        api.get<SessionData>(`/profesor/attendance?sectionId=${sectionId}`),
      ])
      setStudents(stud.students)
      setSessionState(sess.session)
      // Precargar estados existentes
      const initial: Record<string, Estado> = {}
      sess.session?.registros.forEach((r) => {
        initial[r.estudianteId] = r.estado
      })
      setAsistencia(initial)
    } catch (e: unknown) {
      toast.error('Error al cargar: ' + (e as Error).message)
    } finally {
      setLoadingStudents(false)
    }
  }, [])

  useEffect(() => {
    if (selectedSection) loadSection(selectedSection)
  }, [selectedSection, loadSection])

  const setEstado = (studentId: string, estado: Estado) => {
    setAsistencia((prev) => ({ ...prev, [studentId]: estado }))
  }

  const handleSave = async () => {
    if (!selectedSection) return
    const registros = Object.entries(asistencia).map(([estudianteId, estado]) => ({
      estudianteId,
      estado,
    }))
    if (registros.length === 0) {
      toast.error('Marca al menos un estudiante')
      return
    }
    setSaving(true)
    try {
      await api.post('/profesor/attendance', { sectionId: selectedSection, registros })
      toast.success(`Asistencia guardada (${registros.length} estudiantes)`)
      // Recargar sesión
      await loadSection(selectedSection)
    } catch (e: unknown) {
      toast.error('Error al guardar: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async () => {
    if (!sessionState) {
      toast.error('No hay sesión activa para cerrar')
      return
    }
    if (sessionState.estado === 'cerrada') {
      toast.info('La sesión ya está cerrada')
      return
    }
    setClosing(true)
    try {
      const res = await api.put('/profesor/attendance', { sessionId: sessionState.id })
      toast.success(
        `Sesión cerrada. Estudiantes auto-marcados ausentes: ${res.autoMarcadosAusentes ?? 0}`
      )
      await loadSection(selectedSection)
    } catch (e: unknown) {
      toast.error('Error al cerrar: ' + (e as Error).message)
    } finally {
      setClosing(false)
    }
  }

  const marcados = Object.keys(asistencia).length
  const presentes = Object.values(asistencia).filter((e) => e === 'presente').length
  const ausentes = Object.values(asistencia).filter((e) => e === 'ausente').length
  const tardanzas = Object.values(asistencia).filter((e) => e === 'tardanza').length

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-emerald-600" />
            Pasar Asistencia
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('es-VE', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        {sections.length > 0 && (
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecciona sección" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nombre} · {s.plantel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Stats */}
      {selectedSection && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3 py-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{students.length}</p>
          </Card>
          <Card className="p-3 py-3 border-emerald-200 dark:border-emerald-900/50">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Presentes</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
              {presentes}
            </p>
          </Card>
          <Card className="p-3 py-3 border-red-200 dark:border-red-900/50">
            <div className="flex items-center gap-2">
              <X className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Ausentes</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-red-500">{ausentes}</p>
          </Card>
          <Card className="p-3 py-3 border-amber-200 dark:border-amber-900/50">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Tardanzas</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-500">{tardanzas}</p>
          </Card>
        </div>
      )}

      {/* Session status banner */}
      {sessionState?.estado === 'cerrada' && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-orange-800 dark:text-orange-300">
              Sesión cerrada
            </p>
            <p className="text-orange-700 dark:text-orange-400">
              Esta sesión ya fue cerrada. Los estudiantes sin marcar fueron registrados como
              ausentes automáticamente.
            </p>
          </div>
        </div>
      )}

      {/* Student list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de estudiantes</CardTitle>
          <CardDescription>
            {marcados} de {students.length} marcados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStudents ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No hay estudiantes en esta sección</p>
            </div>
          ) : (
            <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {students.map((s) => {
                const estado = asistencia[s.id]
                return (
                  <li
                    key={s.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarFallback
                          className={cn(
                            'text-sm font-semibold',
                            estado === 'presente' &&
                              'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
                            estado === 'ausente' &&
                              'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
                            estado === 'tardanza' &&
                              'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
                            estado === 'justificado' &&
                              'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
                            !estado &&
                              'bg-muted text-muted-foreground'
                          )}
                        >
                          {`${s.nombre[0] || ''}${s.apellido[0] || ''}`.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {s.apellido}, {s.nombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.cedulaEscolar || s.codigoUnico}
                        </p>
                      </div>
                      {estado && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'ml-auto sm:ml-0 sm:hidden text-xs',
                            estado === 'presente' && 'border-emerald-500 text-emerald-700',
                            estado === 'ausente' && 'border-red-500 text-red-700',
                            estado === 'tardanza' && 'border-amber-500 text-amber-700',
                            estado === 'justificado' && 'border-sky-500 text-sky-700'
                          )}
                        >
                          {estado}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-1 sm:flex sm:shrink-0">
                      {estados.map((e) => (
                        <button
                          key={e.value}
                          onClick={() => setEstado(s.id, e.value)}
                          className={cn(
                            'flex flex-col sm:flex-row items-center justify-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-xs font-medium border transition-all',
                            estado === e.value
                              ? e.color
                              : 'bg-background text-muted-foreground border-border hover:bg-accent'
                          )}
                          aria-label={e.label}
                        >
                          {e.icon}
                          <span className="hidden sm:inline">{e.label}</span>
                        </button>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Footer actions */}
      {students.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 sticky bottom-0 bg-background/95 backdrop-blur p-3 -mx-4 md:-mx-6 border-t">
          <Button
            onClick={handleSave}
            disabled={saving || marcados === 0 || sessionState?.estado === 'cerrada'}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando…' : `Guardar Asistencia (${marcados})`}
          </Button>
          <Button
            onClick={handleClose}
            disabled={closing || !sessionState || sessionState.estado === 'cerrada'}
            variant="outline"
            className="sm:w-48 border-orange-400 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950/30"
          >
            <Lock className="w-4 h-4" />
            {closing ? 'Cerrando…' : 'Cerrar Sesión'}
          </Button>
        </div>
      )}
    </div>
  )
}
