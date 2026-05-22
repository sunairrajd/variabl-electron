import { create } from 'zustand'
import type { Playlist } from '../../../shared/types'

interface PlaylistState {
  playlists: Playlist[]
  selectedPlaylistId: string | null
  currentItemIndex: number
  isPlaying: boolean
  setPlaylists: (playlists: Playlist[]) => void
  selectPlaylist: (id: string) => void
  next: () => void
  prev: () => void
  pause: () => void
  resume: () => void
  reset: () => void
}

/** Tab count of the playlist currently selected, or 0 if none. */
const selectedTabCount = (state: PlaylistState): number =>
  state.playlists.find((p) => p.id === state.selectedPlaylistId)?.tabs.length ?? 0

export const usePlaylistStore = create<PlaylistState>((set) => ({
  playlists: [],
  selectedPlaylistId: null,
  currentItemIndex: 0,
  isPlaying: false,
  setPlaylists: (playlists) => set({ playlists }),
  selectPlaylist: (selectedPlaylistId) =>
    set({ selectedPlaylistId, currentItemIndex: 0, isPlaying: true }),
  next: () =>
    set((state) => {
      const count = selectedTabCount(state)
      return count === 0
        ? state
        : { currentItemIndex: (state.currentItemIndex + 1) % count }
    }),
  prev: () =>
    set((state) => {
      const count = selectedTabCount(state)
      return count === 0
        ? state
        : { currentItemIndex: (state.currentItemIndex - 1 + count) % count }
    }),
  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),
  reset: () =>
    set({ selectedPlaylistId: null, currentItemIndex: 0, isPlaying: false })
}))
