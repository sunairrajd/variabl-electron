export interface PlaylistItem {
  id: string
  type: 'website' | 'image' | 'video'
  url?: string
  src?: string
  duration: number
}

export interface Monitor {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  isPrimary: boolean
}
