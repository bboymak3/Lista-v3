'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GraduationCap, Lock, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

interface InvitationInfo {
  valid: boolean
  representante?: {
    id: string
    cedula: string
    nombre: string
    apellido: string
    email: string | null
  }
  expiresAt?: string
  error?: string
}

type Status = 'loading' | 'valid' | 'invalid' | 'submitting' | 'success'

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [status, setStatus] = useState<Status>('loading')
  const [representante, setRepresentante] = useState<InvitationInfo['representante']>(undefined)
  const [errorMsg, setErrorMsg] = useState<string>('El enlace ha expirado o ya fue usado')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formError, setFormError] = useState('')

  // 1. Validar el token al montar
  useEffect(() => {
    let cancelled = false
    async function validate() {
      try {
        const res = await fetch(
          `/api/auth/accept-invitation?token=${encodeURIComponent(token)}`,
          { method: 'GET' }
        )
        const data: InvitationInfo = await res.json().catch(() => ({ valid: false }))
        if (cancelled) return
        if (res.ok && data.valid && data.representante) {
          setRepresentante(data.representante)
          setStatus('valid')
        } else {
          setErrorMsg(data.error || 'El enlace ha expirado o ya fue usado')
          setStatus('invalid')
        }
      } catch {
        if (!cancelled) {
          setErrorMsg('Error de conexión con el servidor')
          setStatus('invalid')
        }
      }
    }
    validate()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setFormError('Las contraseñas no coinciden')
      return
    }

    setStatus('submitting')
    try {
      const res = await fetch(
        `/api/auth/accept-invitation?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        }
      )
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setFormError(data.error || 'No se pudo completar el registro')
        setStatus('valid')
        return
      }

      // Auto-login: guardar token en store
      setAuth(data.token, data.user)
      setStatus('success')
      toast.success(`¡Registro completado! Bienvenido/a, ${data.user.nombre}`)

      // Pequeño delay para que el toast se vea, luego recargar para entrar al AppShell
      setTimeout(() => {
        // Limpiar el query param de invitación de la URL
        const url = new URL(window.location.href)
        url.searchParams.delete('invitacion')
        window.history.replaceState({}, '', url.toString())
        router.refresh()
      }, 900)
    } catch {
      setFormError('Error de conexión con el servidor')
      setStatus('valid')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950 p-4">
      <div className="w-full max-w-md">
        <Card className="border-emerald-200/60 dark:border-emerald-900/40 shadow-xl">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <GraduationCap className="w-9 h-9 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                Completa tu registro
              </CardTitle>
              <CardDescription className="text-base">
                Sistema de Asistencia Escolar Lista
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {status === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <p className="text-sm text-muted-foreground">Verificando invitación...</p>
              </div>
            )}

            {status === 'invalid' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Invitación no válida</p>
                    <p className="text-sm">{errorMsg}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Solicita a Dirección un nuevo enlace de invitación para completar tu
                  registro.
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                <p className="font-semibold text-lg">¡Registro completado!</p>
                <p className="text-sm text-muted-foreground">
                  Iniciando sesión...
                </p>
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              </div>
            )}

            {(status === 'valid' || status === 'submitting') && representante && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3 text-sm">
                  <p className="text-muted-foreground">Bienvenido/a,</p>
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    {representante.nombre} {representante.apellido}
                  </p>
                  {representante.email && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {representante.email}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    C.I. {representante.cedula}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="pl-9 pr-9"
                      disabled={status === 'submitting'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirma la contraseña</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repite la contraseña"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="pl-9 pr-9"
                      disabled={status === 'submitting'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && confirm && password !== confirm && (
                    <p className="text-xs text-red-600">Las contraseñas no coinciden</p>
                  )}
                  {password && confirm && password === confirm && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Las contraseñas coinciden
                    </p>
                  )}
                </div>

                {formError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={status === 'submitting' || password.length < 6 || password !== confirm}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {status === 'submitting' ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Completar registro'
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Tu contraseña será usada para iniciar sesión en el sistema.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
