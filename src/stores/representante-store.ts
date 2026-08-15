'use client'

import { create } from 'zustand'
import { api } from '@/lib/api-client'

export interface ChildPlantel {
  id: string
  nombre: string
  direccion: string | null
  lat: number
  lng: number
  radioM: number
}

export interface ChildSection {
  id: string
  nombre: string
  grado: string
  turno: string
  plantel: ChildPlantel
}

export interface Child {
  id: string
  codigoUnico: string
  nombre: string
  apellido: string
  genero: string | null
  parentesco: string
  esPrincipal: boolean
  section: ChildSection
}

interface RepresentanteState {
  children: Child[]
  selectedChildId: string | null
  loading: boolean
  loaded: boolean
  error: string | null
  fetchChildren: (force?: boolean) => Promise<void>
  selectChild: (id: string) => void
  getSelectedChild: () => Child | null
}

export const useRepresentanteStore = create<RepresentanteState>((set, get) => ({
  children: [],
  selectedChildId: null,
  loading: false,
  loaded: false,
  error: null,
  fetchChildren: async (force?: boolean) => {
    if (get().loaded && !force) return
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const data = await api.get<{ children: Child[] }>('/representante/children')
      const previousSelected = get().selectedChildId
      const stillExists = data.children.some((c) => c.id === previousSelected)
      const selectedChildId = stillExists
        ? previousSelected
        : data.children[0]?.id || null
      set({
        children: data.children,
        selectedChildId,
        loading: false,
        loaded: true,
      })
    } catch (e: unknown) {
      set({ loading: false, error: (e as Error).message })
    }
  },
  selectChild: (id) => set({ selectedChildId: id }),
  getSelectedChild: () => {
    const { children, selectedChildId } = get()
    return children.find((c) => c.id === selectedChildId) || null
  },
}))
