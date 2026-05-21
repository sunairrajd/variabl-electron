import { create } from 'zustand'

type AppState = 'login' | 'onboarding' | 'player'

interface AppStore {
  state: AppState
  setState: (state: AppState) => void
  selectedMonitor: number | null
  setSelectedMonitor: (id: number) => void
}

export const useAppStore = create<AppStore>((set) => ({
  state: 'login', // Initial state
  setState: (state) => set({ state }),
  selectedMonitor: null,
  setSelectedMonitor: (id) => set({ selectedMonitor: id }),
}))
