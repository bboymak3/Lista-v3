'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  GraduationCap,
  School,
  Users,
  CheckCircle2,
  Activity,
  UserPlus,
  ClipboardCheck,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface DashboardStats {
  totals: {
    students: number
    sections: number
    professors: number
    plantels: number
  }
  attendance: {
    todayRate: number
    todayTotal: number
    todayPresent: number
  }
  attendanceBySection: Array<{
    section: string
    presente: number
    ausente: number
    tardanza: number
    total: number
    rate: number
  }>
  recentActivity: Array<{
    type: 'attendance' | 'user' | 'session'
    id: string
    title: string
    description: string
    fecha: string
  }>
}

const chartConfig = {
  presente: {
    label: 'Presentes',
    color: '#10b981',
  },
  ausente: {
    label: 'Ausentes',
    color: '#ef4444',
  },
  tardanza: {
    label: 'Tardanzas',
    color: '#f59e0b',
  },
} satisfies ChartConfig

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{title}</CardDescription>
          <div className={`p-2 rounded-lg ${accent}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <CardTitle className="text-3xl">{value}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
    </Card>
  )
}

function formatRelative(date: string) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
  } catch {
    return '—'
  }
}

const activityIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  attendance: ClipboardCheck,
  user: UserPlus,
  session: Activity,
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<DashboardStats>('/admin/stats')
      setData(res)
    } catch (e: any) {
      setError(e.message || 'Error al cargar estadísticas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-16 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {error || 'No se pudieron cargar los datos'}
        </CardContent>
      </Card>
    )
  }

  const hasChart = data.attendanceBySection.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Resumen general del sistema de asistencia
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Estudiantes activos"
          value={data.totals.students}
          subtitle={`${data.totals.plantels} plantel(es)`}
          icon={GraduationCap}
          accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
        />
        <StatCard
          title="Secciones activas"
          value={data.totals.sections}
          subtitle="Grados en operación"
          icon={School}
          accent="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400"
        />
        <StatCard
          title="Profesores"
          value={data.totals.professors}
          subtitle="Docentes activos"
          icon={Users}
          accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
        />
        <StatCard
          title="Asistencia hoy"
          value={`${data.attendance.todayRate}%`}
          subtitle={`${data.attendance.todayPresent} de ${data.attendance.todayTotal} registros`}
          icon={CheckCircle2}
          accent="bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <CardTitle>Asistencia por sección (últimos 7 días)</CardTitle>
            </div>
            <CardDescription>
              Comparativa de presentes, ausentes y tardanzas por sección
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasChart ? (
              <ChartContainer config={chartConfig} className="h-72 w-full">
                <BarChart data={data.attendanceBySection}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="section"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="presente" fill="var(--color-presente)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ausente" fill="var(--color-ausente)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="tardanza" fill="var(--color-tardanza)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                Sin registros de asistencia en los últimos 7 días
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <CardTitle>Actividad reciente</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72">
              {data.recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Sin actividad registrada
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.recentActivity.map((a) => {
                    const Icon = activityIcon[a.type] || Activity
                    return (
                      <li key={`${a.type}-${a.id}`} className="flex items-start gap-3">
                        <div className="mt-0.5 p-1.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{a.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {a.description}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatRelative(a.fecha)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
