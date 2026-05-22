/**
 * Domain models shared between the main and renderer processes. These mirror
 * the Firestore documents owned by the tab-revolver-web backend.
 */

/** Scene type a playlist tab renders as. */
export type TabType = 'image' | 'video' | 'website'

/** A single rotating item within a playlist. */
export interface PlaylistTab {
  interval: number
  title: string
  type: TabType
  url: string
}

export interface Playlist {
  id: string
  name: string
  tabs: PlaylistTab[]
  defaultInterval: number
  emoji: string
  version: number
  updatedAt: number
}

/** A paired display device, identified by its deviceToken. */
export interface Screen {
  id: string
  screenName: string
  deviceToken: string
  lastSeen: number
  displayId: string
  userId: string
  nowPlayingPlaylistId: string | null
  deleted: boolean
}

/** Subscription tier. Backend enforces limits; the client uses this for UX hints. */
export type PlanTier = 'free' | 'pro' | 'advanced'

export interface UserPlan {
  plan: PlanTier
  planExpiresAt: number | null
  screens: Screen[]
}
