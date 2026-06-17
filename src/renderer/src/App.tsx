import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import PlayerScreen from '@/screens/PlayerScreen'
import OnboardingScreen from '@/screens/OnboardingScreen'
import InactiveScreen from '@/screens/InactiveScreen'
import PlayerOverlayScreen from '@/screens/PlayerOverlayScreen'
import { db, doc, auth } from '@/lib/firebase'
import { onSnapshot, updateDoc } from 'firebase/firestore'

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
  const firebaseUser = useAuthStore((s) => s.firebaseUser)
  const deviceToken = useAuthStore((s) => s.deviceToken)
  const setSelectedMonitorId = useAppStore((s) => s.setSelectedMonitorId)
  const setSelectedPlaylist = useAppStore((s) => s.setSelectedPlaylist)

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user: any) => {
      if (user) {
        useAuthStore.getState().setFirebaseUser({ uid: user.uid, email: user.email })
      } else {
        useAuthStore.getState().setFirebaseUser(null)
        // Auto-login on startup if token exists but Firebase session is empty
        if (deviceToken) {
          await useAuthStore.getState().signInToFirebase(deviceToken)
        }
      }
    })
    return () => unsubscribe()
  }, [deviceToken])

  // Initialization for secondary monitor windows or primary auto-start
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const monitorIdStr = searchParams.get('monitorId')

    if (monitorIdStr) {
      // Secondary Window Logic
      const monitorId = parseInt(monitorIdStr, 10)
      setSelectedMonitorId(monitorId)
      // Ensure the secondary window doesn't inherit the primary window's displayId from localStorage
      useAuthStore.getState().setDisplayId(monitorIdStr)

      try {
        const storedAssignmentsStr = localStorage.getItem('monitorAssignments')
        if (storedAssignmentsStr) {
          const assignments = JSON.parse(storedAssignmentsStr)
          if (assignments[monitorId]) {
            setSelectedPlaylist(assignments[monitorId])
            navigate('player')
          }
        }
      } catch (err) {
        console.error('Failed to load assignments for secondary window:', err)
      }
    } else {
      // Primary Window Logic: Auto-start and monitor-closed listeners
      const setupPrimaryWindow = async () => {
        try {
          const storedStr = localStorage.getItem('monitorAssignments')
          const deviceToken = useAuthStore.getState().deviceToken

          if (storedStr && deviceToken) {
            const assignments = JSON.parse(storedStr)
            const hasAssignments = Object.values(assignments).some(v => v !== null && v !== undefined)

            if (hasAssignments) {
              const monitors = await window.electronAPI.invoke('get-monitors')
              const primaryMonitor = monitors.find((m: any) => m.isPrimary) || monitors[0]

              if (primaryMonitor) {
                setSelectedMonitorId(primaryMonitor.id)
                // Ensure AuthStore displayId matches the actual hardware monitor ID
                useAuthStore.getState().setDisplayId(primaryMonitor.id.toString())
              }

              useAppStore.getState().setMonitorAssignments(assignments)

              window.electronAPI.invoke('start-secondary-players', assignments).catch(console.error)

              const { syncDeviceAndScreens } = await import('@/services/DeviceSyncService')
              await syncDeviceAndScreens(monitors, assignments) // AWAIT this so the backend creates the screen FIRST

              if (primaryMonitor && assignments[primaryMonitor.id]) {
                setSelectedPlaylist(assignments[primaryMonitor.id])
                navigate('player')
              } else {
                navigate('inactive')
              }
            }
          }
        } catch (e) {
          console.error('Failed to auto-start:', e)
        }
      }

      setupPrimaryWindow()

      const cleanupMonitorClosed = window.electronAPI.on('monitor-closed', async (...args: unknown[]) => {
        const closedMonitorId = args[0] as number;
        console.log(`[App] Secondary monitor ${closedMonitorId} closed.`)
        try {
          const storedStr = localStorage.getItem('monitorAssignments')
          if (storedStr) {
            const assignments = JSON.parse(storedStr)
            assignments[closedMonitorId] = null // Clear assignment
            localStorage.setItem('monitorAssignments', JSON.stringify(assignments))
            useAppStore.getState().setMonitorAssignments(assignments)

            const monitors = await window.electronAPI.invoke('get-monitors')
            const { syncDeviceAndScreens } = await import('@/services/DeviceSyncService')
            syncDeviceAndScreens(monitors, assignments)
          }
        } catch (err) {
          console.error('Failed to handle monitor-closed:', err)
        }
      })

      return () => {
        cleanupMonitorClosed()
      }
    }
  }, [])

  // 3-minute heartbeat updating lastSeen in Firestore
  useEffect(() => {
    if (!displayId || !firebaseUser) return

    const sendHeartbeat = async () => {
      try {
        let screenId = displayId
        try {
          const { getStoredScreenId } = await import('@/services/DeviceSyncService')
          screenId = getStoredScreenId(displayId)
        } catch (e) {}

        await updateDoc(doc(db, 'screens', screenId), {
          lastSeen: Date.now()
        })
        console.log('[Heartbeat] Sent active heartbeat update to Firestore')
      } catch (err) {
        // Silently ignore initial heartbeat failures due to race conditions; the 3-minute interval will catch it later.
      }
    }

    // Send immediate heartbeat on activation/startup
    sendHeartbeat()

    const interval = setInterval(sendHeartbeat, 180000)

    return () => clearInterval(interval)
  }, [displayId, firebaseUser])

  // Remote control: listen to nowPlayingPlaylistId from Firestore
  useEffect(() => {
    if (!displayId || currentView === 'onboarding') return

    let isSubscribed = true
    let unsubscribe = () => {}

    const setupListener = async () => {
      let screenId = displayId
      try {
        const { getStoredScreenId } = await import('@/services/DeviceSyncService')
        screenId = getStoredScreenId(displayId)
      } catch (e) {}

      if (!isSubscribed) return

      const screenRef = doc(db, 'screens', screenId)
      unsubscribe = onSnapshot(screenRef, (snapshot) => {
        if (!snapshot.exists()) return

        const data = snapshot.data()
        const playlistId = data?.nowPlayingPlaylistId

        const state = useAppStore.getState()
        const currentSelectedPlaylist = state.selectedPlaylist

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
              const newToken = await useAuthStore.getState().refreshAuthToken()
              if (!newToken) {
                useAuthStore.getState().logout()
                state.navigate('onboarding')
                return
              }
              // If newToken exists, loop will retry naturally
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
    }
    
    setupListener()

    return () => {
      isSubscribed = false
      unsubscribe()
    }
  }, [displayId, currentView])




  const Screen = SCREENS[currentView]
  return <Screen />
}

export default App
