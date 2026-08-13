'use client'

import { useEffect, useState, useCallback } from 'react'
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
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Shield,
  GraduationCap,
  UserCircle,
  User,
} from 'lucide-react'

type RolKey = 'admin' | 'profesor' | 'representante' | 'alumno'

interface UserRow {
  id: string
  cedula: string
  nombre: string
  apellido: string
  email: string | null
  rol: RolKey
  telefono: string | null
  activo: boolean
  createdAt: string
}

const rolLabels: Record<RolKey, string> = {
  admin: 'Dirección',
  profesor: 'Profesor',
  representante: 'Representante',
  alumno: 'Alumno',
}

const rolBadgeClass: Record<RolKey, string> = {
  admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
  profesor: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400 border-teal-200 dark:border-teal-900',
  representante: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-900',
  alumno: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 border-sky-200 dark:border-sky-900',
}

const rolIcon: Record<RolKey, React.ComponentType<{ className?: string }>> = {
  admin: Shield,
  profesor: GraduationCap,
  representante: UserCircle,
  alumno: User,
}

interface UserFormValues {
  cedulaPrefix: string
  cedula: string
  nombre: string
  apellido: string
  email: string
  telefono: string
  rol: RolKey
  password: string
}

function emptyForm(rolDefault: RolKey = 'profesor'): UserFormValues {
  return {
    cedulaPrefix: 'V-',
    cedula: '',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    rol: rolDefault,
    password: '',
  }
}

export function UsersManager({ defaultRole = 'profesor' as RolKey }: { defaultRole?: RolKey }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [rolFilter, setRolFilter] = useState<string>(defaultRole === 'profesor' ? 'profesor' : 'all')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [form, setForm] = useState<UserFormValues>(emptyForm(defaultRole))
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (rolFilter !== 'all') params.set('rol', rolFilter)
      if (search) params.set('search', search)
      params.set('includeInactive', 'true')
      const res = await api.get<{ data: UserRow[] }>(`/admin/users?${params.toString()}`)
      setUsers(res.data || [])
    } catch (e: any) {
      toast.error('Error al cargar usuarios', { description: e.message })
    } finally {
      setLoading(false)
    }
  }, [rolFilter, search])

  useEffect(() => {
    const t = setTimeout(loadUsers, 250)
    return () => clearTimeout(t)
  }, [loadUsers])

  const openCreate = () => {
    setEditing(null)
    setForm({
      ...emptyForm(defaultRole),
      rol: (rolFilter !== 'all' ? (rolFilter as RolKey) : defaultRole),
    })
    setDialogOpen(true)
  }

  const openEdit = (u: UserRow) => {
    setEditing(u)
    // La cédula puede venir con prefijo V- o E-; lo separamos
    const match = u.cedula.match(/^([VE])-?(.+)$/)
    const prefix = match ? `${match[1]}-` : 'V-'
    const cedulaNum = match ? match[2] : u.cedula
    setForm({
      cedulaPrefix: prefix,
      cedula: cedulaNum,
      nombre: u.nombre,
      apellido: u.apellido,
      email: u.email || '',
      telefono: u.telefono || '',
      rol: u.rol,
      password: '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.cedula || !form.nombre || !form.apellido || !form.rol) {
      toast.error('Cédula, nombre, apellido y rol son obligatorios')
      return
    }
    if (!editing && !form.password) {
      toast.error('La contraseña es obligatoria para nuevos usuarios')
      return
    }
    setSubmitting(true)
    try {
      const fullCedula = `${form.cedulaPrefix}${form.cedula}`
      const payload: any = {
        cedula: fullCedula,
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email || null,
        telefono: form.telefono || null,
        rol: form.rol,
      }
      if (form.password) payload.password = form.password

      if (editing) {
        await api.put(`/admin/users/${editing.id}`, payload)
        toast.success('Usuario actualizado')
      } else {
        await api.post('/admin/users', payload)
        toast.success('Usuario creado')
      }
      setDialogOpen(false)
      loadUsers()
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar usuario')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`)
      toast.success('Usuario desactivado')
      setDeleteTarget(null)
      loadUsers()
    } catch (e: any) {
      toast.error(e.message || 'Error al desactivar')
    }
  }

  const handleToggleActivo = async (u: UserRow) => {
    setTogglingId(u.id)
    try {
      await api.put(`/admin/users/${u.id}`, { activo: !u.activo })
      setUsers((prev) =>
        prev.map((row) => (row.id === u.id ? { ...row, activo: !row.activo } : row))
      )
      toast.success(u.activo ? 'Usuario desactivado' : 'Usuario activado')
    } catch (e: any) {
      toast.error(e.message || 'Error al cambiar estado')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Usuarios</h2>
          <p className="text-sm text-muted-foreground">
            Administra cuentas de dirección, profesores, representantes y alumnos
          </p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Tabs value={rolFilter} onValueChange={setRolFilter}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="admin">Dirección</TabsTrigger>
                <TabsTrigger value="profesor">Profesores</TabsTrigger>
                <TabsTrigger value="representante">Representantes</TabsTrigger>
                <TabsTrigger value="alumno">Alumnos</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">No hay usuarios registrados</p>
              <Button
                onClick={openCreate}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="w-4 h-4" />
                Crear primer usuario
              </Button>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto -mx-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead className="text-center">Activo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const Icon = rolIcon[u.rol]
                    return (
                      <TableRow key={u.id} className={!u.activo ? 'opacity-60' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center text-xs font-semibold shrink-0">
                              {u.nombre[0]?.toUpperCase()}
                              {u.apellido[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {u.apellido}, {u.nombre}
                              </p>
                              <p className="text-xs text-muted-foreground">{u.cedula}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {u.email || '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          {u.telefono || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={rolBadgeClass[u.rol]}>
                            <Icon className="w-3 h-3" />
                            {rolLabels[u.rol]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={u.activo}
                            onCheckedChange={() => handleToggleActivo(u)}
                            disabled={togglingId === u.id}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(u)}
                              aria-label="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                              onClick={() => setDeleteTarget(u)}
                              aria-label="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && users.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>{users.length} usuario(s)</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Actualiza los datos del usuario. Deja la contraseña vacía para mantener la actual.'
                : 'Completa el formulario para crear una cuenta de usuario.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cedula">Cédula *</Label>
              <div className="flex gap-2">
                <Select
                  value={form.cedulaPrefix}
                  onValueChange={(v) => setForm({ ...form, cedulaPrefix: v })}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="V-">V-</SelectItem>
                    <SelectItem value="E-">E-</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="cedula"
                  type="text"
                  placeholder="00000000"
                  value={form.cedula}
                  onChange={(e) => setForm({ ...form, cedula: e.target.value.replace(/\D/g, '') })}
                  required
                  className="flex-1"
                />
              </div>
            </div>
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  placeholder="0412-0000000"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rol">Rol *</Label>
                <Select
                  value={form.rol}
                  onValueChange={(v) => setForm({ ...form, rol: v as RolKey })}
                >
                  <SelectTrigger id="rol" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Dirección</SelectItem>
                    <SelectItem value="profesor">Profesor</SelectItem>
                    <SelectItem value="representante">Representante</SelectItem>
                    <SelectItem value="alumno">Alumno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">
                Contraseña {editing && <span className="text-muted-foreground">(vacío = sin cambio)</span>} *
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={editing ? '•••••••• (sin cambio)' : 'Mínimo 6 caracteres'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editing}
                minLength={editing ? 0 : 6}
              />
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
                {editing ? 'Guardar cambios' : 'Crear usuario'}
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
            <AlertDialogTitle>¿Desactivar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              El usuario <strong>{deleteTarget?.nombre} {deleteTarget?.apellido}</strong> será
              marcado como inactivo. No podrá iniciar sesión, pero su registro se conservará.
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
