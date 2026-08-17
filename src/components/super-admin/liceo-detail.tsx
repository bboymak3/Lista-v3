'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import { useViewStore } from '@/stores/view-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, School, Users, GraduationCap } from 'lucide-react'
import { toast } from 'sonner'

interface PlantelDetail {
  id: string
  nombre: string
  descripcion: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  logoKey: string | null
  lat: number
  lng: number
  radioM: number
  periodoActual: string
}

interface StudentRow { id: string; nombre: string; apellido: string; codigoUnico: string; sectionName: string; grado: string }
interface UserRow { id: string; nombre: string; apellido: string; cedula: string; email: string | null; rol: string }
interface SectionRow { id: string; nombre: string; grado: string; turno: string; activa: number }

export function LiceoDetail() {
  const setActiveView = useViewStore((s) => s.setActiveView)
  const [plantel, setPlantel] = useState<PlantelDetail | null>(null)
  const [students, setStudents] = useState<StudentRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [sections, setSections] = useState<SectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('estudiantes')

  useEffect(() => {
    const id = localStorage.getItem('selectedPlantelId')
    if (!id) {
      setActiveView('super-admin-liceos')
      return
    }
    Promise.all([
      api.get<{ plantel: PlantelDetail }>(`/super-admin/plantels/${id}`),
      api.get<{ students: StudentRow[] }>(`/super-admin/plantels/${id}/students`).catch(() => ({ students: [] })),
      api.get<{ users: UserRow[] }>(`/super-admin/plantels/${id}/users`).catch(() => ({ users: [] })),
      api.get<{ sections: SectionRow[] }>(`/super-admin/plantels/${id}/sections`).catch(() => ({ sections: [] })),
    ]).then(([p, s, u, sec]) => {
      setPlantel(p.plantel)
      setStudents(s.students || [])
      setUsers(u.users || [])
      setSections(sec.sections || [])
    }).catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [setActiveView])

  if (loading) {
    return <Skeleton className="h-96 w-full" />
  }
  if (!plantel) return null

  const turnLabel = (t: string) => ({ manana: 'Mañana', tarde: 'Tarde', nocturno: 'Nocturno' }[t] || t)

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => setActiveView('super-admin-liceos')} className="mb-2">
        <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Liceos
      </Button>

      {/* Header */}
      <Card className="border-emerald-200 dark:border-emerald-900">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {plantel.logoKey ? (
              <img src={`/api/files/${plantel.logoKey}`} alt={plantel.nombre} className="w-16 h-16 rounded-xl object-cover border" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                <School className="w-8 h-8 text-emerald-600" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{plantel.nombre}</h2>
              {plantel.descripcion && <p className="text-sm text-muted-foreground mt-1">{plantel.descripcion}</p>}
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                <span>📍 {students.length} estudiantes</span>
                <span>👥 {users.length} usuarios</span>
                <span>🏫 {sections.length} secciones</span>
                <span>🎯 Radio {plantel.radioM}m</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="estudiantes">Estudiantes ({students.length})</TabsTrigger>
          <TabsTrigger value="profesores">Profesores</TabsTrigger>
          <TabsTrigger value="representantes">Representantes</TabsTrigger>
          <TabsTrigger value="secciones">Secciones ({sections.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="estudiantes" className="mt-4">
          <Card><CardContent className="p-0">
            {students.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <GraduationCap className="w-12 h-12 mx-auto mb-2 opacity-40" />
                No hay estudiantes en este liceo
              </div>
            ) : (
              <div className="divide-y">
                {students.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-4 hover:bg-accent/50">
                    <div>
                      <p className="font-medium">{s.nombre} {s.apellido}</p>
                      <p className="text-xs text-muted-foreground">{s.codigoUnico} · {s.sectionName} · {s.grado}°</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="profesores" className="mt-4">
          <Card><CardContent className="p-0">
            {users.filter(u => u.rol === 'profesor' || u.rol === 'admin').length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-40" />
                No hay profesores/admins en este liceo
              </div>
            ) : (
              <div className="divide-y">
                {users.filter(u => u.rol === 'profesor' || u.rol === 'admin').map(u => (
                  <div key={u.id} className="flex items-center justify-between p-4 hover:bg-accent/50">
                    <div>
                      <p className="font-medium">{u.nombre} {u.apellido} · {u.cedula}</p>
                      <p className="text-xs text-muted-foreground">{u.email || 'Sin email'}</p>
                    </div>
                    <Badge variant={u.rol === 'admin' ? 'default' : 'secondary'}>{u.rol}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="representantes" className="mt-4">
          <Card><CardContent className="p-0">
            {users.filter(u => u.rol === 'representante').length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-40" />
                No hay representantes en este liceo
              </div>
            ) : (
              <div className="divide-y">
                {users.filter(u => u.rol === 'representante').map(u => (
                  <div key={u.id} className="p-4 hover:bg-accent/50">
                    <p className="font-medium">{u.nombre} {u.apellido} · {u.cedula}</p>
                    <p className="text-xs text-muted-foreground">{u.email || 'Sin email'}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="secciones" className="mt-4">
          <Card><CardContent className="p-0">
            {sections.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <School className="w-12 h-12 mx-auto mb-2 opacity-40" />
                No hay secciones en este liceo
              </div>
            ) : (
              <div className="divide-y">
                {sections.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-4 hover:bg-accent/50">
                    <div>
                      <p className="font-medium">{s.nombre} · {s.grado}°</p>
                      <p className="text-xs text-muted-foreground">Turno {turnLabel(s.turno)}</p>
                    </div>
                    {s.activa === 1 ? <Badge>Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
