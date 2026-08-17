'use client'

import { useState, useEffect } from 'react'
import { useAuthStore, type Role } from '@/stores/auth-store'
import { useViewStore } from '@/stores/view-store'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { UpdatePrompt } from '@/components/shared/update-prompt'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  MapPin,
  ClipboardCheck,
  Camera,
  Bell,
  LogOut,
  Menu,
  QrCode,
  Newspaper,
  Settings,
  UserCircle,
  FileText,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/theme-toggle'

// Profesor views (lazy loaded inline)
import { ProfesorDashboard } from '@/components/profesor/profesor-dashboard'
import { AttendanceTaker } from '@/components/profesor/attendance-taker'
import { ProfesorCheckin } from '@/components/profesor/profesor-checkin'
import { FeedPoster } from '@/components/profesor/feed-poster'
import { ProfesorNotifications } from '@/components/profesor/profesor-notifications'

// Dirección (admin) views
import { AdminDashboard } from '@/components/direccion/admin-dashboard'
import { StudentsManager } from '@/components/direccion/students-manager'
import { SectionsManager } from '@/components/direccion/sections-manager'
import { PlantelConfig } from '@/components/direccion/plantel-config'
import { UsersManager } from '@/components/direccion/users-manager'
import { SendPdf } from '@/components/direccion/send-pdf'
import { RepresentanteStudents } from '@/components/direccion/representante-students'

// Representante views
import { RepresentanteDashboard } from '@/components/representante/representante-dashboard'
import { ChildLocationMap } from '@/components/representante/child-location-map'
import { ChildAttendance } from '@/components/representante/child-attendance'
import { RepresentanteFeed } from '@/components/representante/representante-feed'
import { RepresentanteNotifications } from '@/components/representante/representante-notifications'
import { RepresentanteProfile } from '@/components/representante/representante-profile'
import { RepresentanteJustifications } from '@/components/representante/representante-justifications'

// Alumno views
import { AlumnoDashboard } from '@/components/alumno/alumno-dashboard'
import { CarnetDigital } from '@/components/alumno/carnet-digital'
import { AlumnoCheckin } from '@/components/alumno/alumno-checkin'
import { AlumnoFeed } from '@/components/alumno/alumno-feed'

type NavItem = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  view: string
}

const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, view: 'admin-dashboard' },
    { id: 'students', label: 'Estudiantes', icon: GraduationCap, view: 'admin-students' },
    { id: 'sections', label: 'Secciones', icon: School, view: 'admin-sections' },
    { id: 'professors', label: 'Profesores', icon: Users, view: 'admin-professors' },
    { id: 'plantel', label: 'Geocerca', icon: MapPin, view: 'admin-plantel' },
    { id: 'send-pdf', label: 'Enviar PDF', icon: FileText, view: 'admin-send-pdf' },
    { id: 'representante-students', label: 'Asignar Representantes', icon: Users, view: 'admin-representante-students' },
    { id: 'users', label: 'Usuarios', icon: UserCircle, view: 'admin-users' },
  ],
  profesor: [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard, view: 'profesor-dashboard' },
    { id: 'attendance', label: 'Asistencia', icon: ClipboardCheck, view: 'profesor-attendance' },
    { id: 'checkin', label: 'Mi Check-in', icon: MapPin, view: 'profesor-checkin' },
    { id: 'feed', label: 'Publicar', icon: Camera, view: 'profesor-feed' },
    { id: 'notifications', label: 'Avisos', icon: Bell, view: 'profesor-notifications' },
  ],
  representante: [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard, view: 'representante-dashboard' },
    { id: 'location', label: 'Ubicación', icon: MapPin, view: 'representante-location' },
    { id: 'attendance', label: 'Asistencia', icon: ClipboardCheck, view: 'representante-attendance' },
    { id: 'justifications', label: 'Justificaciones', icon: ClipboardList, view: 'representante-justifications' },
    { id: 'feed', label: 'Noticias', icon: Newspaper, view: 'representante-feed' },
    { id: 'notifications', label: 'Avisos', icon: Bell, view: 'representante-notifications' },
    { id: 'profile', label: 'Mi Perfil', icon: Settings, view: 'representante-profile' },
  ],
  alumno: [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard, view: 'alumno-dashboard' },
    { id: 'carnet', label: 'Carnet', icon: QrCode, view: 'alumno-carnet' },
    { id: 'checkin', label: 'Check-in', icon: MapPin, view: 'alumno-checkin' },
    { id: 'feed', label: 'Noticias', icon: Newspaper, view: 'alumno-feed' },
  ],
}

const roleLabels: Record<Role, string> = {
  admin: 'Dirección',
  profesor: 'Profesor',
  representante: 'Representante',
  alumno: 'Alumno',
}

interface SidebarContentProps {
  user: { nombre: string; apellido: string; cedula: string; rol: Role }
  navItems: NavItem[]
  activeView: string
  onSelectView: (view: string) => void
  onLogout: () => void
}

function SidebarContent({
  user,
  navItems,
  activeView,
  onSelectView,
  onLogout,
}: SidebarContentProps) {
  const initials = `${user.nombre[0] || ''}${user.apellido[0] || ''}`.toUpperCase()
  return (
    <div className="flex flex-col h-full">
      {/* Logo / Header */}
      <div className="px-4 py-5 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">Lista</h1>
            <p className="text-xs text-muted-foreground mt-1">{roleLabels[user.rol]}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeView === item.view
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectView(item.view)
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                isActive
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="w-9 h-9">
            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user.nombre} {user.apellido}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.cedula}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="w-full mt-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 justify-start"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  )
}

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const activeView = useViewStore((s) => s.activeView)
  const setActiveView = useViewStore((s) => s.setActiveView)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // Registrar push notifications (Android)
  usePushNotifications()

  // Handle back button: si está en una vista que no es dashboard, volver al dashboard
  // en lugar de salir de la app (fix bug doble click)
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // Prevenir el comportamiento por defecto de salir de la app
      e.preventDefault()
      if (activeView !== 'dashboard' && !activeView.endsWith('-dashboard')) {
        // Volver al dashboard en vez de salir
        const initial: Record<Role, string> = {
          admin: 'admin-dashboard',
          profesor: 'profesor-dashboard',
          representante: 'representante-dashboard',
          alumno: 'alumno-dashboard',
        }
        if (user) {
          setActiveView(initial[user.rol])
          // Restaurar el historial sin añadir entrada nueva
          window.history.pushState(null, '', window.location.href)
        }
      } else {
        // Si ya está en dashboard, permitir salir (pushState para que no salga sin confirmar)
        window.history.pushState(null, '', window.location.href)
      }
    }
    // Inicializar historial para capturar el back button
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [activeView, user, setActiveView])

  // Initialize active view based on role once user is loaded
  useEffect(() => {
    if (!user) return
    if (activeView === 'dashboard') {
      const initial: Record<Role, string> = {
        admin: 'admin-dashboard',
        profesor: 'profesor-dashboard',
        representante: 'representante-dashboard',
        alumno: 'alumno-dashboard',
      }
      setActiveView(initial[user.rol])
    }
  }, [user, activeView, setActiveView])

  if (!user) return null

  const navItems = navByRole[user.rol]
  const activeItem = navItems.find((i) => i.view === activeView) || navItems[0]

  const handleLogout = () => {
    setShowLogoutConfirm(true)
  }

  const confirmLogout = () => {
    logout()
    setShowLogoutConfirm(false)
    toast.success('Sesión cerrada')
  }

  const handleSelectView = (view: string) => {
    setActiveView(view)
    setMobileOpen(false)
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 lg:w-72 border-r bg-card flex-col shrink-0">
        <SidebarContent
          user={user}
          navItems={navItems}
          activeView={activeView}
          onSelectView={handleSelectView}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navegación</SheetTitle>
          </SheetHeader>
          <SidebarContent
            user={user}
            navItems={navItems}
            activeView={activeView}
            onSelectView={handleSelectView}
            onLogout={handleLogout}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b bg-card">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(true)}
                className="shrink-0"
              >
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
          </Sheet>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">Lista</span>
          </div>
          <ThemeToggle className="shrink-0" />
        </header>

        {/* Page Header */}
        <header className="hidden md:flex items-center justify-between px-6 h-14 border-b bg-card">
          <h2 className="font-semibold text-lg">{activeItem?.label}</h2>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-6xl mx-auto">
            <ViewRenderer view={activeView} />
          </div>
        </main>
      </div>

      {/* Confirmación de logout */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a salir de tu cuenta. Tendrás que iniciar sesión nuevamente para acceder al sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, quedarme</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLogout}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sí, cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Prompt de actualización de versión */}
      <UpdatePrompt />
    </div>
  )
}

// View renderer — lazy loads the right component based on role+view
function ViewRenderer({ view }: { view: string }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return null

  // === ADMIN VIEWS ===
  if (user.rol === 'admin') {
    switch (view) {
      case 'admin-dashboard':
        return <AdminDashboard />
      case 'admin-students':
        return <StudentsManager />
      case 'admin-sections':
        return <SectionsManager />
      case 'admin-professors':
        return <UsersManager defaultRole="profesor" />
      case 'admin-plantel':
        return <PlantelConfig />
      case 'admin-send-pdf':
        return <SendPdf />
      case 'admin-representante-students':
        return <RepresentanteStudents />
      case 'admin-users':
        return <UsersManager />
      default:
        return <AdminDashboard />
    }
  }

  // === PROFESOR VIEWS ===
  if (user.rol === 'profesor') {
    switch (view) {
      case 'profesor-dashboard':
        return <ProfesorDashboard />
      case 'profesor-attendance':
        return <AttendanceTaker />
      case 'profesor-checkin':
        return <ProfesorCheckin />
      case 'profesor-feed':
        return <FeedPoster />
      case 'profesor-notifications':
        return <ProfesorNotifications />
      default:
        return <ProfesorDashboard />
    }
  }

  // === REPRESENTANTE VIEWS ===
  if (user.rol === 'representante') {
    switch (view) {
      case 'representante-dashboard':
        return <RepresentanteDashboard />
      case 'representante-location':
        return <ChildLocationMap />
      case 'representante-attendance':
        return <ChildAttendance />
      case 'representante-feed':
        return <RepresentanteFeed />
      case 'representante-notifications':
        return <RepresentanteNotifications />
      case 'representante-justifications':
        return <RepresentanteJustifications />
      case 'representante-profile':
        return <RepresentanteProfile />
      default:
        return <RepresentanteDashboard />
    }
  }

  // === ALUMNO VIEWS ===
  if (user.rol === 'alumno') {
    switch (view) {
      case 'alumno-dashboard':
        return <AlumnoDashboard />
      case 'alumno-carnet':
        return <CarnetDigital />
      case 'alumno-checkin':
        return <AlumnoCheckin />
      case 'alumno-feed':
        return <AlumnoFeed />
      default:
        return <AlumnoDashboard />
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-8 text-center">
        <h3 className="text-xl font-semibold mb-2">
          Bienvenido/a, {user.nombre} {user.apellido}
        </h3>
        <p className="text-muted-foreground">
          Panel de {roleLabels[user.rol]} — sección en construcción
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          Vista activa: <code className="px-2 py-0.5 rounded bg-muted">{view}</code>
        </p>
      </div>
    </div>
  )
}
