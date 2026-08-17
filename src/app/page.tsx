'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { LoginForm } from '@/components/auth/login-form'
import { AcceptInvitation } from '@/components/auth/accept-invitation'
import { AppShell } from '@/components/layouts/app-shell'
import { Loader2 } from 'lucide-react'

export default function Home() {
  // useSyncExternalStore-like pattern: detectar hidratación sin setState en effect
  const [hydrated, setHydrated] = useState(false)
  const [invitationToken, setInvitationToken] = useState<string | null>(null)
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    // requestAnimationFrame asegura que ocurra después del primer paint
    requestAnimationFrame(() => {
      try {
        const urlParams = new URLSearchParams(window.location.search)
        const inv = urlParams.get('invitacion') || urlParams.get('token')
        setInvitationToken(inv)
      } catch {
        setInvitationToken(null)
      }
      setHydrated(true)
    })
  }, [])

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  // Pantalla pública de aceptación de invitación: solo si NO hay sesión iniciada.
  // Si el usuario ya está logueado, ignoramos la invitación y vamos a AppShell.
  if (invitationToken && !token && !user) {
    return <AcceptInvitation token={invitationToken} />
  }

  if (!token || !user) {
    return <LoginForm />
  }

  return <AppShell />
}
