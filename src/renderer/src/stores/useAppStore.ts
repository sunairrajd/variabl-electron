import { create } from 'zustand'

/** Top-level screen the app is currently showing. */
export type AppView = 'pairing' | 'picker' | 'player'

interface AppState {
  currentView: AppView
  selectedMonitorId: number | null
  navigate: (view: AppView) => void
  setSelectedMonitorId: (id: number | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'pairing',
  selectedMonitorId: null,
  navigate: (currentView) => set({ currentView }),
  setSelectedMonitorId: (selectedMonitorId) => set({ selectedMonitorId })
}))
