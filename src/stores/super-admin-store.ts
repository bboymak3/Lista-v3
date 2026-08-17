'use client'

import { create } from 'zustand'

interface SuperAdminState {
  selectedPlantelId: string | null
  setSelectedPlantel: (id: string | null) => void
}

// Store simple para mantener el plantelId seleccionado en el panel de super admin.
// Permite navegar entre la grilla de liceos y el detalle sin prop drilling.
export const useSuperAdminStore = create<SuperAdminState>((set) => ({
  selectedPlantelId: null,
  setSelectedPlantel: (id) => set({ selectedPlantelId: id }),
}))
