import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  selectedConsultorioId: string | null
  setSelectedConsultorioId: (id: string | null) => void
  activeTab: string
  setActiveTab: (tab: string) => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedConsultorioId: null,
      activeTab: 'dashboard',
      sidebarCollapsed: false,
      setSelectedConsultorioId: (id) => set({ selectedConsultorioId: id }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'hubdental-ui',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    }
  )
)
