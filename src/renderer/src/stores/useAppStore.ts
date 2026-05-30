import { create } from 'zustand'

/** Top-level screen the app is currently showing. */
export type AppView = 'pairing' | 'picker' | 'player' | 'onboarding'

export interface PlaylistTab {
  interval: number;
  title: string;
  type: string;
  url: string;
}

export interface Playlist {
  id: string
  userId: string
  name: string
  tabs: PlaylistTab[]
  defaultInterval: number
  rotationType?: string
  emoji?: string
}

interface AppState {
  currentView: AppView
  selectedMonitorId: number | null
  selectedPlaylist: Playlist | null
  navigate: (view: AppView) => void
  setSelectedMonitorId: (id: number | null) => void
  setSelectedPlaylist: (playlist: Playlist | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'onboarding',
  selectedMonitorId: null,
  selectedPlaylist: null,
  navigate: (currentView) => set({ currentView }),
  setSelectedMonitorId: (selectedMonitorId) => set({ selectedMonitorId }),
  setSelectedPlaylist: (selectedPlaylist) => set({ selectedPlaylist })
}))
