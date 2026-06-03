import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import PlayerScreen from '@/screens/PlayerScreen'
import OnboardingScreen from '@/screens/OnboardingScreen'
import InactiveScreen from '@/screens/InactiveScreen'
import PlayerOverlayScreen from '@/screens/PlayerOverlayScreen'
import { rtdb, rtdbRef, rtdbUpdate } from '@/lib/firebase'
import { onValue } from 'firebase/database'

const SCREENS = {
  player: PlayerScreen,
  onboarding: OnboardingScreen,
  inactive: InactiveScreen,
} as const

function App(): React.JSX.Element {
  const currentView = useAppStore((s) => s.currentView)
  const navigate = useAppStore((s) => s.navigate)
  const setDeviceToken = useAuthStore((s) => s.setDeviceToken)
  const displayId = useAuthStore((s) => s.displayId)

  // 3-minute heartbeat updating lastSeen in Firebase Realtime Database
  useEffect(() => {
    if (!displayId) return

    const sendHeartbeat = async () => {
      try {
        await rtdbUpdate(rtdbRef(rtdb, `screens/${displayId}`), {
          lastSeen: Date.now()
        })
        console.log('[Heartbeat] Sent active heartbeat update to RTDB')
      } catch (err) {
        console.error('[Heartbeat] Failed to send heartbeat to RTDB:', err)
      }
    }

    // Send immediate heartbeat on activation/startup
    sendHeartbeat()

    const interval = setInterval(sendHeartbeat, 180000)

    return () => clearInterval(interval)
  }, [displayId])

  // Auto-login: a stored deviceToken means the device was already paired.
  useEffect(() => {
    const token = useAuthStore.getState().deviceToken
    if (token && token.length > 0) {
      navigate('player')
    }
  }, [navigate])

  // Remote control: listen to nowPlayingPlaylistId from RTDB
  useEffect(() => {
    if (!displayId) return

    const screenRef = rtdbRef(rtdb, `screens/${displayId}/nowPlayingPlaylistId`)
    const unsubscribe = onValue(screenRef, (snapshot) => {
      const playlistId = snapshot.val()

      const state = useAppStore.getState()
      const currentView = state.currentView
      const currentSelectedPlaylist = state.selectedPlaylist

      // Ignore remote control commands if we are in onboarding
      if (currentView === 'onboarding') return

      if (!playlistId) {
        state.navigate('inactive')
        return
      }

      // If already playing this playlist, ignore
      if (playlistId === currentSelectedPlaylist?.id && currentView === 'player') return

      let attempts = 0
      const maxAttempts = 12 // up to 1 minute (12 * 5s)

      const tryFetch = async () => {
        try {
          const baseUrl = 'https://tabrevolver.variabl.co'
          const deviceToken = useAuthStore.getState().deviceToken
          if (!deviceToken) return

          const updatedPlaylists = await window.electronAPI.invoke('fetch-playlists', baseUrl, deviceToken)
          const targetPlaylist = updatedPlaylists.find((p: any) => p.id === playlistId)

          if (targetPlaylist) {
            console.log(`[RemoteControl] Found playlist ${playlistId}, starting playback.`)
            state.setSelectedPlaylist(targetPlaylist)
            state.navigate('player')
            return
          }
        } catch (e: any) {
          console.error("[RemoteControl] Error fetching playlists:", e)
          if (e.message?.includes('401')) {
            useAuthStore.getState().logout()
            state.navigate('onboarding')
            return
          }
        }

        attempts++
        if (attempts < maxAttempts) {
          console.log(`[RemoteControl] Playlist ${playlistId} not found, retrying... (${attempts}/${maxAttempts})`)
          setTimeout(tryFetch, 8000)
        } else {
          console.warn(`[RemoteControl] Could not find playlist ${playlistId} after 1 minute.`)
        }
      }

      tryFetch()
    })

    return () => unsubscribe()
  }, [displayId])




  const Screen = SCREENS[currentView]
  return <Screen />
}

export default App
