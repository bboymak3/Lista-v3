'use client'

import { create } from 'zustand'

interface ViewState {
  activeView: string
  setActiveView: (view: string) => void
}

// Store simple para navegación entre vistas dentro del AppShell.
// Permite que componentes hijos (ej. dashboard) naveguen sin prop drilling.
export const useViewStore = create<ViewState>((set) => ({
  activeView: 'dashboard',
  setActiveView: (view) => set({ activeView: view }),
}))
