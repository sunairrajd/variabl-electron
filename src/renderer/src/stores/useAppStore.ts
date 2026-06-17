import { create } from 'zustand'

/** Top-level screen the app is currently showing. */
export type AppView = 'player' | 'onboarding' | 'inactive'

export interface PlaylistTab {
  interval: number;
  title: string;
  type: string;
  url: string;
  zoom?: number;
  scroll?: {
    enabled: boolean;
    position: number;
  };
  mute?: boolean;
  thumbnailURL?: string;
  faviconURL?: string;
  backgroundColor?: string;
  fontColor?: string;
  scale?: string;
  message?: string;
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
  monitorAssignments: Record<number, Playlist | null>
  skipCountdown: boolean
  navigate: (view: AppView) => void
  setSelectedMonitorId: (id: number | null) => void
  setSelectedPlaylist: (playlist: Playlist | null) => void
  setMonitorAssignments: (assignments: Record<number, Playlist | null>) => void
  setSkipCountdown: (skip: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'onboarding',
  selectedMonitorId: null,
  selectedPlaylist: null,
  monitorAssignments: {},
  skipCountdown: false,
  navigate: (currentView) => set({ currentView }),
  setSelectedMonitorId: (selectedMonitorId) => set({ selectedMonitorId }),
  setSelectedPlaylist: (selectedPlaylist) => set({ selectedPlaylist }),
  setMonitorAssignments: (monitorAssignments) => set({ monitorAssignments }),
  setSkipCountdown: (skipCountdown) => set({ skipCountdown })
}))
