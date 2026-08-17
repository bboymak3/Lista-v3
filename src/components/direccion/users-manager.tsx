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
  UserPlus,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  KeyRound,
  Link2,
} from 'lucide-react'

// Genera una contraseña aleatoria alfanumérica legible (sin caracteres ambiguos)
function generateRandomPassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz'
  let out = ''
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined
  if (cryptoObj && cryptoObj.getRandomValues) {
    const arr = new Uint32Array(length)
    cryptoObj.getRandomValues(arr)
    for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length]
  } else {
    for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

type RolKey = 'admin' | 'profesor' | 'representante' | 'alumno'

interface UserRow {
  id: string
  cedula: string
  nombre: string
  apellido: string
  email: string | null
  rol: RolKey
  telefono: string | null
  whatsapp: string | null
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
  whatsapp: string
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
    whatsapp: '',
    rol: rolDefault,
    password: '',
  }
}

interface RepFormValues {
  cedulaPrefix: string
  cedula: string
  nombre: string
  apellido: string
  email: string
  telefono: string
  whatsapp: string
  password: string
}

function emptyRepForm(): RepFormValues {
  return {
    cedulaPrefix: 'V-',
    cedula: '',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    whatsapp: '',
    password: generateRandomPassword(),
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
  // Dedicated "Crear Representante" dialog state
  const [repDialogOpen, setRepDialogOpen] = useState(false)
  const [repForm, setRepForm] = useState<RepFormValues>(emptyRepForm())
  const [repSubmitting, setRepSubmitting] = useState(false)
  const [repCopied, setRepCopied] = useState(false)
  const [repResult, setRepResult] = useState<{
    cedula: string
    nombre: string
    password: string
    whatsapp: string | null
    inviteUrl: string
    whatsappUrl: string | null
    whatsappNumber: string | null
    inviteMessage: string
    expiresAt: string
    expiresAtDays: number
  } | null>(null)
  // Invitation state (existing representantes — server-side invite token)
  const [inviteTarget, setInviteTarget] = useState<UserRow | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteData, setInviteData] = useState<{
    token: string
    url: string
    whatsappUrl: string | null
    whatsappNumber: string | null
    message: string
    expiresAt: string
    expiresAtDays: number
  } | null>(null)
  const [copied, setCopied] = useState(false)

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
      whatsapp: u.whatsapp || '',
      rol: u.rol,
      password: '',
    })
    setDialogOpen(true)
  }

  const openCreateRepresentante = () => {
    setRepForm(emptyRepForm())
    setRepResult(null)
    setRepCopied(false)
    setRepDialogOpen(true)
  }

  const regenerateRepPassword = () => {
    setRepForm((prev) => ({ ...prev, password: generateRandomPassword() }))
  }

  const copyRepPassword = async () => {
    try {
      await navigator.clipboard.writeText(repForm.password)
      setRepCopied(true)
      toast.success('Contraseña copiada')
      setTimeout(() => setRepCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const handleCreateRepresentante = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repForm.cedula || !repForm.nombre || !repForm.apellido || !repForm.password) {
      toast.error('Cédula, nombre, apellido y contraseña son obligatorios')
      return
    }
    if (repForm.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setRepSubmitting(true)
    try {
      const fullCedula = `${repForm.cedulaPrefix}${repForm.cedula}`
      const payload = {
        cedula: fullCedula,
        nombre: repForm.nombre,
        apellido: repForm.apellido,
        email: repForm.email || null,
        telefono: repForm.telefono || null,
        whatsapp: repForm.whatsapp || null,
        password: repForm.password,
      }
      const created = await api.post<{ id: string; cedula: string; nombre: string }>(
        '/admin/representantes',
        payload
      )
      toast.success('Representante creado')
      // Generar invitación server-side inmediatamente después de crear
      let inviteUrl = ''
      let whatsappUrl: string | null = null
      let whatsappNumber: string | null = null
      let inviteMessage = ''
      let expiresAt = ''
      let expiresAtDays = 7
      try {
        const inv = await api.post<{
          token: string
          url: string
          whatsappUrl: string | null
          whatsappNumber: string | null
          message: string
          expiresAt: string
          expiresAtDays: number
        }>(`/admin/representantes/${created.id}/invite`)
        inviteUrl = inv.url
        whatsappUrl = inv.whatsappUrl
        whatsappNumber = inv.whatsappNumber
        inviteMessage = inv.message
        expiresAt = inv.expiresAt
        expiresAtDays = inv.expiresAtDays
      } catch (e: any) {
        // Si falla la generación del token, aún podemos mostrar el resultado
        // con password. El admin puede usar el botón "Invitar" después.
        console.error('No se pudo generar invitación:', e)
      }
      setRepResult({
        cedula: created.cedula,
        nombre: created.nombre,
        password: repForm.password,
        whatsapp: repForm.whatsapp || null,
        inviteUrl,
        whatsappUrl,
        whatsappNumber,
        inviteMessage,
        expiresAt,
        expiresAtDays,
      })
      loadUsers()
    } catch (e: any) {
      toast.error(e.message || 'Error al crear representante')
    } finally {
      setRepSubmitting(false)
    }
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
        whatsapp: form.whatsapp || null,
        rol: form.rol,
      }
      if (form.password) payload.password = form.password

      if (editing) {
        await api.put(`/admin/users/${editing.id}`, payload)
        toast.success('Usuario actualizado')
        setDialogOpen(false)
        loadUsers()
      } else {
        await api.post('/admin/users', payload)
        toast.success('Usuario creado')
        setDialogOpen(false)
        loadUsers()
      }
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar usuario')
    } finally {
      setSubmitting(false)
    }
  }

  const openInvite = async (user: UserRow) => {
    setInviteTarget(user)
    setInviteData(null)
    setCopied(false)
    setInviteOpen(true)
    setInviteLoading(true)
    try {
      const data = await api.post<{
        token: string
        url: string
        whatsappUrl: string | null
        whatsappNumber: string | null
        message: string
        expiresAt: string
        expiresAtDays: number
      }>(`/admin/representantes/${user.id}/invite`)
      setInviteData(data)
    } catch (e: any) {
      toast.error(e.message || 'Error al generar invitación')
      setInviteOpen(false)
    } finally {
      setInviteLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!inviteData?.url) return
    try {
      await navigator.clipboard.writeText(inviteData.url)
      setCopied(true)
      toast.success('Enlace copiado al portapapeles')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar el enlace')
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
        <div className="flex gap-2 flex-wrap">
          {(rolFilter === 'all' || rolFilter === 'representante') && (
            <Button
              onClick={openCreateRepresentante}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <UserPlus className="w-4 h-4" />
              Crear Representante
            </Button>
          )}
          <Button
            onClick={openCreate}
            variant="outline"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            <Plus className="w-4 h-4" />
            Nuevo usuario
          </Button>
        </div>
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
              <div className="mt-4 flex justify-center gap-2 flex-wrap">
                {(rolFilter === 'all' || rolFilter === 'representante') && (
                  <Button
                    onClick={openCreateRepresentante}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <UserPlus className="w-4 h-4" />
                    Crear Representante
                  </Button>
                )}
                <Button
                  onClick={openCreate}
                  variant="outline"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                >
                  <Plus className="w-4 h-4" />
                  Crear primer usuario
                </Button>
              </div>
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
                            {u.rol === 'representante' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                                onClick={() => openInvite(u)}
                                aria-label="Enviar invitación"
                                title="Enviar invitación por WhatsApp"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </Button>
                            )}
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
                  onChange={(e) => setForm({ ...form, cedula: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })}
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

      {/* Dedicated Crear Representante Dialog */}
      <Dialog open={repDialogOpen} onOpenChange={setRepDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-600" />
              Crear Representante
            </DialogTitle>
            <DialogDescription>
              Registra un representante. Se generará una contraseña temporal y un enlace de invitación para compartir.
            </DialogDescription>
          </DialogHeader>

          {repResult ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4">
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Representante creado: {repResult.nombre}
                </p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  Cédula
                </Label>
                <Input readOnly value={repResult.cedula} className="font-mono text-sm" />
              </div>

              <div className="space-y-2">
                <Label>Contraseña temporal</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={repResult.password}
                    className="font-mono text-sm"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyRepPassword}
                    className="shrink-0"
                    aria-label="Copiar contraseña"
                  >
                    {repCopied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Contraseña de respaldo. El representante puede elegir su propia contraseña
                  usando el enlace de invitación a continuación.
                </p>
              </div>

              {repResult.inviteUrl ? (
                <>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-muted-foreground" />
                      Enlace de invitación
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={repResult.inviteUrl}
                        className="text-xs font-mono"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(repResult.inviteUrl)
                            toast.success('Enlace copiado')
                          } catch {
                            toast.error('No se pudo copiar')
                          }
                        }}
                        className="shrink-0"
                        aria-label="Copiar enlace"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Expira en {repResult.expiresAtDays} días. Al abrirlo, el representante
                      elige su propia contraseña.
                    </p>
                  </div>

                  {repResult.whatsappUrl ? (
                    <div className="space-y-2">
                      <Label>WhatsApp</Label>
                      <p className="text-xs text-muted-foreground">
                        Número: +{repResult.whatsappNumber}
                      </p>
                      <a
                        href={repResult.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Enviar por WhatsApp
                        <ExternalLink className="w-3 h-3 opacity-80" />
                      </a>
                      <details className="mt-1">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Ver mensaje
                        </summary>
                        <p className="mt-2 p-3 rounded-md bg-muted text-xs whitespace-pre-wrap">
                          {repResult.inviteMessage}
                        </p>
                      </details>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3">
                      <p className="text-sm text-amber-800 dark:text-amber-400">
                        Sin WhatsApp: no se configuró un número válido.
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                        Copia el enlace de invitación y envíalo manualmente, o comparte la
                        cédula y contraseña temporal.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-400">
                    No se pudo generar el enlace de invitación automáticamente.
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                    Comparte la cédula y contraseña temporal manualmente.
                  </p>
                </div>
              )}

              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">¿Cómo funciona?</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Envía el enlace por WhatsApp (o cópialo y compártelo).</li>
                  <li>Al abrirlo, el representante verá su nombre y elegirá su contraseña.</li>
                  <li>Tras completar el registro, inicia sesión normalmente.</li>
                </ol>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRepResult(null)
                    setRepForm(emptyRepForm())
                  }}
                >
                  Crear otro
                </Button>
                <Button
                  type="button"
                  onClick={() => setRepDialogOpen(false)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateRepresentante} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rep-cedula">Cédula *</Label>
                <div className="flex gap-2">
                  <Select
                    value={repForm.cedulaPrefix}
                    onValueChange={(v) => setRepForm({ ...repForm, cedulaPrefix: v })}
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
                    id="rep-cedula"
                    type="text"
                    placeholder="00000000"
                    value={repForm.cedula}
                    onChange={(e) =>
                      setRepForm({ ...repForm, cedula: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })
                    }
                    required
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="rep-nombre">Nombre *</Label>
                  <Input
                    id="rep-nombre"
                    value={repForm.nombre}
                    onChange={(e) => setRepForm({ ...repForm, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rep-apellido">Apellido *</Label>
                  <Input
                    id="rep-apellido"
                    value={repForm.apellido}
                    onChange={(e) => setRepForm({ ...repForm, apellido: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rep-email">Email (opcional)</Label>
                <Input
                  id="rep-email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={repForm.email}
                  onChange={(e) => setRepForm({ ...repForm, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="rep-telefono">Teléfono</Label>
                  <Input
                    id="rep-telefono"
                    placeholder="0412-0000000"
                    value={repForm.telefono}
                    onChange={(e) => setRepForm({ ...repForm, telefono: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rep-whatsapp">WhatsApp</Label>
                  <Input
                    id="rep-whatsapp"
                    placeholder="584120000000"
                    value={repForm.whatsapp}
                    onChange={(e) =>
                      setRepForm({ ...repForm, whatsapp: e.target.value.replace(/[^0-9]/g, '') })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rep-password">Contraseña temporal *</Label>
                <div className="flex gap-2">
                  <Input
                    id="rep-password"
                    value={repForm.password}
                    onChange={(e) => setRepForm({ ...repForm, password: e.target.value })}
                    required
                    minLength={6}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={regenerateRepPassword}
                    className="shrink-0"
                    aria-label="Regenerar contraseña"
                    title="Generar nueva contraseña"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyRepPassword}
                    className="shrink-0"
                    aria-label="Copiar contraseña"
                  >
                    {repCopied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Se generó automáticamente. Puedes regenerarla o editarla.
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRepDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={repSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {repSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <UserPlus className="w-4 h-4 mr-1" />
                  Crear y generar link de invitación
                </Button>
              </DialogFooter>
            </form>
          )}
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

      {/* Invitation Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
              Invitación por WhatsApp
            </DialogTitle>
            <DialogDescription>
              Comparte este enlace con{' '}
              <strong className="text-foreground">
                {inviteTarget?.nombre} {inviteTarget?.apellido}
              </strong>{' '}
              para que establezca su propia contraseña.
            </DialogDescription>
          </DialogHeader>

          {inviteLoading && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm text-muted-foreground">Generando invitación...</p>
            </div>
          )}

          {inviteData && (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3">
                <p className="text-sm text-emerald-900 dark:text-emerald-200">
                  ✓ Enlace generado correctamente.
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  Expira en {inviteData.expiresAtDays} días.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Enlace de invitación</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={inviteData.url}
                    className="text-xs font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyLink}
                    className="shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {inviteData.whatsappUrl ? (
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <p className="text-xs text-muted-foreground">
                    Número: +{inviteData.whatsappNumber}
                  </p>
                  <a
                    href={inviteData.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Abrir WhatsApp
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      Ver mensaje
                    </summary>
                    <p className="mt-2 p-3 rounded-md bg-muted text-xs whitespace-pre-wrap">
                      {inviteData.message}
                    </p>
                  </details>
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-400">
                    Este representante no tiene un número de WhatsApp configurado.
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                    Edita el usuario para añadir su WhatsApp, o copia y envía el enlace
                    manualmente.
                  </p>
                </div>
              )}

              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">¿Cómo funciona?</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Envía el enlace al representante por WhatsApp o copiándolo.</li>
                  <li>Al abrirlo, el representante verá su nombre y deberá elegir una contraseña.</li>
                  <li>Tras completar el registro, podrá iniciar sesión normalmente.</li>
                </ol>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setInviteOpen(false)}
            >
              Cerrar
            </Button>
            {inviteData && inviteTarget && (
              <Button
                type="button"
                onClick={() => openInvite(inviteTarget)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Generar nuevo enlace
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
