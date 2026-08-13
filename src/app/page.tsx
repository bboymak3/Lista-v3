'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { LoginForm } from '@/components/auth/login-form'
import { AppShell } from '@/components/layouts/app-shell'
import { Loader2 } from 'lucide-react'

export default function Home() {
  // useSyncExternalStore-like pattern: detectar hidratación sin setState en effect
  const [hydrated, setHydrated] = useState(false)
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    // requestAnimationFrame asegura que ocurra después del primer paint
    requestAnimationFrame(() => setHydrated(true))
  }, [])

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!token || !user) {
    return <LoginForm />
  }

  return <AppShell />
}
