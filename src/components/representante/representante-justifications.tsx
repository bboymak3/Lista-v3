'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api-client'
import { useRepresentanteStore } from '@/stores/representante-store'
import { ChildSelector } from './child-selector'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { toast } from 'sonner'
import {
  ClipboardList,
  Plus,
  CalendarDays,
  Trash2,
  Inbox,
  Users,
} from 'lucide-react'

interface Justification {
  id: string
  estudianteId: string
  estudianteNombre: string
  estudianteApellido: string
  representanteId: string
  fecha: string // YYYY-MM-DD
  motivo: string
  motivoLabel: string
  descripcion: string | null
  estado: string // pendiente | aprobada | rechazada
  createdAt: string
}

const MOTIVO_OPTIONS = [
  { value: 'enfermedad', label: 'Enfermedad' },
  { value: 'cita_medica', label: 'Cita médica' },
  { value: 'viaje', label: 'Viaje' },
  { value: 'familiar', label: 'Familiar' },
  { value: 'otro', label: 'Otro' },
]

function todayStr(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Estilos por estado
function estadoBadge(estado: string): { className: string; label: string } {
  switch (estado) {
    case 'aprobada':
      return {
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        label: 'Aprobada',
      }
    case 'rechazada':
      return {
        className: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 border-red-300 dark:border-red-800',
        label: 'Rechazada',
      }
    case 'pendiente':
    default:
      return {
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        label: 'Pendiente',
      }
  }
}

function motivoBadge(motivo: string, label: string): string {
  // Mismo estilo neutral para el motivo, distinguible del estado
  return 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border-teal-300 dark:border-teal-800'
}

function formatDateLong(fechaStr: string): string {
  // fechaStr es YYYY-MM-DD
  const d = new Date(fechaStr + 'T12:00:00')
  if (isNaN(d.getTime())) return fechaStr
  return d.toLocaleDateString('es-VE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function RepresentanteJustifications() {
  const children = useRepresentanteStore((s) => s.children)
  const selectedChildId = useRepresentanteStore((s) => s.selectedChildId)
  const fetchChildren = useRepresentanteStore((s) => s.fetchChildren)
  const loadingChildren = useRepresentanteStore((s) => s.loading)

  const [justifications, setJustifications] = useState<Justification[]>([])
  const [loading, setLoading] = useState(true)

  // Estado del dialog de creación
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    fecha: todayStr(),
    motivo: '',
    descripcion: '',
  })

  useEffect(() => {
    fetchChildren()
  }, [fetchChildren])

  const selectedChild = children.find((c) => c.id === selectedChildId) || null

  const loadJustifications = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<{ justifications: Justification[] }>(
        '/representante/justifications'
      )
      setJustifications(d.justifications || [])
    } catch (e: unknown) {
      toast.error('Error al cargar justificaciones: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadJustifications().catch(() => {
      // errores ya manejados dentro de loadJustifications
    })
  }, [loadJustifications])

  // Filtrar por hijo seleccionado (si hay)
  const filteredJustifications = selectedChild
    ? justifications.filter((j) => j.estudianteId === selectedChild.id)
    : justifications

  function resetForm() {
    setForm({ fecha: todayStr(), motivo: '', descripcion: '' })
  }

  async function handleSubmit() {
    if (!selectedChild) {
      toast.error('Selecciona un hijo/a primero')
      return
    }
    if (!form.fecha || !form.motivo) {
      toast.error('Fecha y motivo son obligatorios')
      return
    }
    setSubmitting(true)
    try {
      const created = await api.post<Justification>('/representante/justifications', {
        estudianteId: selectedChild.id,
        fecha: form.fecha,
        motivo: form.motivo,
        descripcion: form.descripcion.trim() || undefined,
      })
      setJustifications((prev) => [created, ...prev])
      resetForm()
      setDialogOpen(false)
      toast.success('Justificación registrada. El tutor y la dirección fueron notificados.')
    } catch (e: unknown) {
      toast.error('Error al registrar: ' + (e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel(id: string) {
    try {
      await api.delete(`/representante/justifications/${id}`)
      setJustifications((prev) => prev.filter((j) => j.id !== id))
      toast.success('Justificación cancelada')
    } catch (e: unknown) {
      toast.error('Error al cancelar: ' + (e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-emerald-600" />
            Justificaciones
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Notifica a la escuela la ausencia de tu hijo/a
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Justificación
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nueva justificación</DialogTitle>
              <DialogDescription>
                {selectedChild
                  ? `Notificas ausencia de ${selectedChild.nombre} ${selectedChild.apellido}.`
                  : 'Selecciona primero un hijo/a.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="just-fecha">Fecha de ausencia</Label>
                <Input
                  id="just-fecha"
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  max={todayStr()}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="just-motivo">Motivo</Label>
                <Select
                  value={form.motivo}
                  onValueChange={(v) => setForm((f) => ({ ...f, motivo: v }))}
                >
                  <SelectTrigger id="just-motivo">
                    <SelectValue placeholder="Selecciona un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVO_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="just-desc">Descripción (opcional)</Label>
                <Textarea
                  id="just-desc"
                  placeholder="Detalles adicionales sobre la ausencia..."
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                  rows={3}
                  maxLength={500}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false)
                  resetForm()
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !selectedChild || !form.motivo || !form.fecha}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? 'Registrando...' : 'Registrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Selector de hijo */}
      <ChildSelector />

      {/* Empty children */}
      {!loadingChildren && children.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No tienes hijos asociados</p>
          </CardContent>
        </Card>
      )}

      {/* Lista */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            Justificaciones registradas
          </CardTitle>
          <CardDescription>
            {selectedChild
              ? `De ${selectedChild.nombre} ${selectedChild.apellido} · últimos 30 días`
              : 'Todos tus hijos · últimos 30 días'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredJustifications.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Inbox className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No has registrado justificaciones</p>
              <p className="text-xs mt-1">
                Usa el botón «Nueva Justificación» para notificar una ausencia.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-96 pr-4">
              <ul className="space-y-3">
                {filteredJustifications.map((j) => {
                  const est = estadoBadge(j.estado)
                  return (
                    <li
                      key={j.id}
                      className="p-4 rounded-lg border bg-card hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold capitalize">
                            {formatDateLong(j.fecha)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {j.estudianteNombre} {j.estudianteApellido}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <Badge
                            variant="outline"
                            className={motivoBadge(j.motivo, j.motivoLabel)}
                          >
                            {j.motivoLabel}
                          </Badge>
                          <Badge variant="outline" className={est.className}>
                            {est.label}
                          </Badge>
                        </div>
                      </div>
                      {j.descripcion && (
                        <p className="text-sm text-muted-foreground mt-2 italic border-l-2 pl-3">
                          «{j.descripcion}»
                        </p>
                      )}
                      {j.estado === 'pendiente' && (
                        <div className="mt-3 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancel(j.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="w-4 h-4 mr-1.5" />
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
