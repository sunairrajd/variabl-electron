import { create } from 'zustand'
import { PlaylistItem } from '../types'

interface PlaylistState {
  items: PlaylistItem[]
  currentIndex: number
  isPlaying: boolean
  setItems: (items: PlaylistItem[]) => void
  next: () => void
  play: () => void
  pause: () => void
}

const mockPlaylist: PlaylistItem[] = [
  {
    id: '1',
    type: 'website',
    url: 'https://grafana.com',
    duration: 15
  },
  {
    id: '2',
    type: 'image',
    src: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1920&q=80',
    duration: 10
  },
  {
    id: '3',
    type: 'video',
    src: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: 20
  }
]

export const usePlaylistStore = create<PlaylistState>((set) => ({
  items: mockPlaylist,
  currentIndex: 0,
  isPlaying: true,
  setItems: (items) => set({ items, currentIndex: 0 }),
  next: () => set((state) => ({ 
    currentIndex: (state.currentIndex + 1) % state.items.length 
  })),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
}))
