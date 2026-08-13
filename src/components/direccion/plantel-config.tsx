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
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  MapPin,
  Plus,
  Loader2,
  Save,
  School,
  Crosshair,
  Radio,
} from 'lucide-react'

interface Plantel {
  id: string
  nombre: string
  direccion: string | null
  lat: number
  lng: number
  radioM: number
  periodoActual: string
  sectionCount: number
}

export function PlantelConfig() {
  const [plantels, setPlantels] = useState<Plantel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')
  const [form, setForm] = useState({
    nombre: '',
    direccion: '',
    lat: '',
    lng: '',
    radioM: '150',
    periodoActual: '',
  })
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    nombre: '',
    direccion: '',
    lat: '',
    lng: '',
    radioM: '150',
  })
  const [creating, setCreating] = useState(false)

  const loadPlantels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ data: Plantel[] }>('/admin/plantels')
      const list = res.data || []
      setPlantels(list)
      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id)
      }
    } catch (e: any) {
      toast.error('Error al cargar planteles', { description: e.message })
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    loadPlantels()
  }, [loadPlantels])

  // Cargar datos del plantel seleccionado al cambiar
  useEffect(() => {
    const p = plantels.find((x) => x.id === selectedId)
    if (p) {
      setForm({
        nombre: p.nombre,
        direccion: p.direccion || '',
        lat: String(p.lat),
        lng: String(p.lng),
        radioM: String(p.radioM),
        periodoActual: p.periodoActual,
      })
    }
  }, [selectedId, plantels])

  const selected = plantels.find((x) => x.id === selectedId)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId) return
    if (!form.nombre || !form.lat || !form.lng) {
      toast.error('Nombre, latitud y longitud son obligatorios')
      return
    }
    setSaving(true)
    try {
      await api.put(`/admin/plantels/${selectedId}`, {
        nombre: form.nombre,
        direccion: form.direccion || null,
        lat: Number(form.lat),
        lng: Number(form.lng),
        radioM: Number(form.radioM) || 150,
        periodoActual: form.periodoActual || undefined,
      })
      toast.success('Plantel actualizado')
      await loadPlantels()
    } catch (e: any) {
      toast.error(e.message || 'Error al actualizar plantel')
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.nombre || !createForm.lat || !createForm.lng) {
      toast.error('Nombre, latitud y longitud son obligatorios')
      return
    }
    setCreating(true)
    try {
      const res = await api.post<Plantel>('/admin/plantels', {
        nombre: createForm.nombre,
        direccion: createForm.direccion || null,
        lat: Number(createForm.lat),
        lng: Number(createForm.lng),
        radioM: Number(createForm.radioM) || 150,
      })
      toast.success('Plantel creado')
      setCreateOpen(false)
      setCreateForm({ nombre: '', direccion: '', lat: '', lng: '', radioM: '150' })
      await loadPlantels()
      setSelectedId(res.id)
    } catch (e: any) {
      toast.error(e.message || 'Error al crear plantel')
    } finally {
      setCreating(false)
    }
  }

  // Escala visual del radio: 50–500m → 20–80% del círculo visual
  const radioM = Number(form.radioM) || 150
  const visualSize = Math.max(20, Math.min(80, (radioM / 500) * 80 + 20))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Geocerca del plantel</h2>
          <p className="text-sm text-muted-foreground">
            Configura la ubicación y el radio de validación del plantel
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="w-4 h-4" />
          Nuevo plantel
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      ) : plantels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <School className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              No hay planteles registrados
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="w-4 h-4" />
              Crear primer plantel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sidebar: lista de planteles */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Planteles ({plantels.length})</CardTitle>
              <CardDescription>Selecciona para editar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {plantels.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedId === p.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-700'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <School
                      className={`w-4 h-4 shrink-0 ${
                        selectedId === p.id ? 'text-emerald-600' : 'text-muted-foreground'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.direccion || 'Sin dirección'}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {p.sectionCount} sec.
                    </Badge>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Form + visualización */}
          {selected && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  {selected.nombre}
                </CardTitle>
                <CardDescription>
                  Lat: {selected.lat.toFixed(6)}, Lng: {selected.lng.toFixed(6)} · Radio actual:{' '}
                  {selected.radioM}m
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="p-nombre">Nombre del plantel *</Label>
                    <Input
                      id="p-nombre"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="p-direccion">Dirección</Label>
                    <Input
                      id="p-direccion"
                      placeholder="Dirección física del plantel"
                      value={form.direccion}
                      onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="p-lat">Latitud *</Label>
                      <Input
                        id="p-lat"
                        type="number"
                        step="any"
                        placeholder="10.4806"
                        value={form.lat}
                        onChange={(e) => setForm({ ...form, lat: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-lng">Longitud *</Label>
                      <Input
                        id="p-lng"
                        type="number"
                        step="any"
                        placeholder="-66.9036"
                        value={form.lng}
                        onChange={(e) => setForm({ ...form, lng: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="p-radio">Radio de geocerca (metros)</Label>
                      <Input
                        id="p-radio"
                        type="number"
                        min={20}
                        max={2000}
                        step={10}
                        value={form.radioM}
                        onChange={(e) => setForm({ ...form, radioM: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p-periodo">Periodo escolar actual</Label>
                      <Input
                        id="p-periodo"
                        placeholder="2024-2025"
                        value={form.periodoActual}
                        onChange={(e) => setForm({ ...form, periodoActual: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Visualización del radio */}
                  <div className="rounded-xl border bg-gradient-to-br from-emerald-50/40 to-teal-50/40 dark:from-emerald-950/20 dark:to-teal-950/20 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Radio className="w-4 h-4 text-emerald-600" />
                      <p className="text-sm font-medium">Visualización de la geocerca</p>
                    </div>
                    <div className="flex items-center justify-center py-6">
                      <div className="relative w-48 h-48 flex items-center justify-center">
                        {/* Cuadrícula de fondo */}
                        <div
                          className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-300/40 dark:border-emerald-700/40"
                          style={{
                            background:
                              'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
                          }}
                        />
                        {/* Círculo del radio (escala visual) */}
                        <div
                          className="absolute rounded-full bg-emerald-500/20 border-2 border-emerald-500 dark:bg-emerald-500/30"
                          style={{
                            width: `${visualSize}%`,
                            height: `${visualSize}%`,
                            transition: 'width 0.2s, height 0.2s',
                          }}
                        />
                        {/* Centro = plantel */}
                        <div className="relative z-10 flex flex-col items-center">
                          <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center shadow-lg">
                            <Crosshair className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                        <span>Plantel (centro)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-emerald-500/20" />
                        <span>Radio: {radioM}m</span>
                      </div>
                    </div>
                    <p className="text-center text-xs text-muted-foreground mt-3">
                      Los check-ins GPS deberán estar dentro de este radio para validarse
                      automáticamente.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      {saving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Guardar cambios
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo plantel</DialogTitle>
            <DialogDescription>
              Registra un nuevo plantel con su ubicación y geocerca inicial.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="c-nombre">Nombre del plantel *</Label>
              <Input
                id="c-nombre"
                placeholder="Ej: U.E. Nacional Simón Bolívar"
                value={createForm.nombre}
                onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-direccion">Dirección</Label>
              <Input
                id="c-direccion"
                placeholder="Dirección física (opcional)"
                value={createForm.direccion}
                onChange={(e) => setCreateForm({ ...createForm, direccion: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="c-lat">Latitud *</Label>
                <Input
                  id="c-lat"
                  type="number"
                  step="any"
                  placeholder="10.4806"
                  value={createForm.lat}
                  onChange={(e) => setCreateForm({ ...createForm, lat: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-lng">Longitud *</Label>
                <Input
                  id="c-lng"
                  type="number"
                  step="any"
                  placeholder="-66.9036"
                  value={createForm.lng}
                  onChange={(e) => setCreateForm({ ...createForm, lng: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-radio">Radio de geocerca (metros)</Label>
              <Input
                id="c-radio"
                type="number"
                min={20}
                max={2000}
                step={10}
                value={createForm.radioM}
                onChange={(e) => setCreateForm({ ...createForm, radioM: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crear plantel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
