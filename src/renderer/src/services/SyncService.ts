import { Playlist } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'

/**
 * SyncService is responsible for syncing tab-specific parameters (like zoom and scroll)
 * back to the backend. It debounces the requests to prevent spamming the API.
 */
export class SyncService {
  private static timeouts: Record<string, NodeJS.Timeout> = {}

  /**
   * Syncs the entire playlist to the official backend API.
   * Debounces calls by 1000ms per playlist.
   */
  static syncPlaylistSettings(playlist: Playlist) {
    if (this.timeouts[playlist.id]) {
      clearTimeout(this.timeouts[playlist.id])
    }

    this.timeouts[playlist.id] = setTimeout(async () => {
      try {
        console.log(`[SyncService] Syncing playlist ${playlist.id} to tabrevolver API...`)

        const baseUrl = 'https://tabrevolver.variabl.co'
        const token = useAuthStore.getState().deviceToken || ''

        // Use IPC to bypass CORS restrictions in the renderer process
        await window.electronAPI.invoke('sync-playlist', baseUrl, token, playlist.id, playlist.tabs)

        console.log(`[SyncService] Successfully synced playlist ${playlist.id} to backend.`)
      } catch (error) {
        console.error('[SyncService] Error syncing playlist to backend:', error)
      }
    }, 1000)
  }
}
