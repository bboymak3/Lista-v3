'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useViewStore } from '@/stores/view-store'
import { api } from '@/lib/api-client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Search, GraduationCap, Users, School, MapPin, Bell, ClipboardCheck, QrCode } from 'lucide-react'

interface SearchResult {
  id: string
  type: 'student' | 'user' | 'section' | 'plantel'
  nombre: string
  subtitulo: string
  action?: string // view to navigate to
}

export function GlobalSearch() {
  const user = useAuthStore((s) => s.user)
  const setActiveView = useViewStore((s) => s.setActiveView)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])

  // Ctrl+K / Cmd+K para abrir
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const search_ = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([])
      return
    }
    try {
      let r: SearchResult[] = []
      // Buscar según rol
      if (user?.rol === 'admin' || user?.rol === 'super_admin') {
        // Estudiantes
        const s = await api.get<{ data: any[] } | any[]>(`/admin/students?q=${encodeURIComponent(q)}&limit=5`)
        const students = Array.isArray(s) ? s : (s as any).data || []
        r.push(...students.map((st: any) => ({
          id: st.id,
          type: 'student' as const,
          nombre: `${st.nombre} ${st.apellido}`,
          subtitulo: `Estudiante · ${st.codigoUnico}`,
          action: 'admin-students'
        })))

        // Usuarios
        const u = await api.get<{ data: any[] } | any[]>(`/admin/users?q=${encodeURIComponent(q)}&limit=5`)
        const users = Array.isArray(u) ? u : (u as any).data || []
        r.push(...users.map((us: any) => ({
          id: us.id,
          type: 'user' as const,
          nombre: `${us.nombre} ${us.apellido}`,
          subtitulo: `${us.rol} · ${us.cedula}`,
          action: 'admin-users'
        })))
      }
      setResults(r.slice(0, 10))
    } catch {
      setResults([])
    }
  }, [user])

  useEffect(() => {
    const t = setTimeout(() => search_(search), 300)
    return () => clearTimeout(t)
  }, [search, search_])

  const handleSelect = (r: SearchResult) => {
    if (r.action) setActiveView(r.action)
    setOpen(false)
    setSearch('')
  }

  if (!user) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm text-muted-foreground hover:bg-accent transition-colors"
      >
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs border rounded bg-muted">⌘K</kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 max-w-2xl gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Búsqueda global</DialogTitle>
          </DialogHeader>
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar estudiantes, profesores, cédula..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-80">
              <CommandEmpty>
                {search.length < 2 ? 'Escribe al menos 2 caracteres' : 'Sin resultados'}
              </CommandEmpty>
              {results.length > 0 && (
                <CommandGroup heading="Resultados">
                  {results.map((r) => (
                    <CommandItem
                      key={`${r.type}-${r.id}`}
                      onSelect={() => handleSelect(r)}
                      className="cursor-pointer"
                    >
                      {r.type === 'student' && <GraduationCap className="w-4 h-4 mr-2 text-emerald-600" />}
                      {r.type === 'user' && <Users className="w-4 h-4 mr-2 text-blue-600" />}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{r.nombre}</p>
                        <p className="text-xs text-muted-foreground">{r.subtitulo}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
