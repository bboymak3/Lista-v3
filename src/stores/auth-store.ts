'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'admin' | 'profesor' | 'representante' | 'alumno'

export interface AuthUser {
  id: string
  cedula: string
  rol: Role
  nombre: string
  apellido: string
  estudianteId?: string | null
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => !!get().token && !!get().user,
    }),
    { name: 'lista-auth' }
  )
)
