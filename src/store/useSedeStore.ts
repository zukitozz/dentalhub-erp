import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface SedeElegida {
  sedeId: string | null // null = todas las sedes
  nombre: string | null
}

interface SedeState extends SedeElegida {
  /** true cuando el gerente ya eligió sede en esta sesión. */
  elegida: boolean
  setSede: (sede: SedeElegida) => void
  reset: () => void
}

// sessionStorage: la elección vive solo mientras dure la sesión del navegador.
export const useSedeStore = create<SedeState>()(
  persist(
    (set) => ({
      sedeId: null,
      nombre: null,
      elegida: false,
      setSede: ({ sedeId, nombre }) => set({ sedeId, nombre, elegida: true }),
      reset: () => set({ sedeId: null, nombre: null, elegida: false }),
    }),
    { name: 'hubdental-sede', storage: createJSONStorage(() => sessionStorage) }
  )
)
