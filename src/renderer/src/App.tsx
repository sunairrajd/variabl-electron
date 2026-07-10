import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import PlayerScreen from '@/screens/PlayerScreen'
import OnboardingScreen from '@/screens/OnboardingScreen'
import InactiveScreen from '@/screens/InactiveScreen'
import PlayerOverlayScreen from '@/screens/PlayerOverlayScreen'
import { db, doc, auth } from '@/lib/firebase'
import { onSnapshot, updateDoc } from 'firebase/firestore'
import { trackPageView } from '@/lib/analytics'

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
  const isUpdateReady = useAppStore((s) => s.isUpdateReady)
  const setUpdateReady = useAppStore((s) => s.setUpdateReady)
  const updateCountdown = useAppStore((s) => s.updateCountdown)
  const decrementUpdateCountdown = useAppStore((s) => s.decrementUpdateCountdown)

  // Track global screen page views in Google Analytics
  useEffect(() => {
    trackPageView(currentView, `${currentView.charAt(0).toUpperCase()}${currentView.slice(1)} Screen`)
  }, [currentView])

  // Auto-updater countdown logic
  useEffect(() => {
    if (!isUpdateReady) return

    const timer = setInterval(() => {
      decrementUpdateCountdown()
    }, 1000)

    return () => clearInterval(timer)
  }, [isUpdateReady, decrementUpdateCountdown])

  // Trigger update when countdown hits 0
  useEffect(() => {
    if (isUpdateReady && updateCountdown <= 0) {
      window.electronAPI.invoke('install-update')
    }
  }, [isUpdateReady, updateCountdown])

  // Listen to auto-updater ready event
  useEffect(() => {
    const cleanup = window.electronAPI.on('update-ready', () => {
      console.log('[App] Received update-ready from main process')
      setUpdateReady(true)
    })
    return cleanup
  }, [])

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
          } else {
            navigate('inactive')
          }
        } else {
          navigate('inactive')
        }
      } catch (err) {
        console.error('Failed to load assignments for secondary window:', err)
      }
    } else {
      // Primary Window Logic: monitor-closed listeners
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

      const cleanupForceLogout = window.electronAPI.on('force-logout', () => {
        console.log('[App] Received force-logout from main process')
        sessionStorage.removeItem('hasSeenSplash')
        useAuthStore.getState().logout()
        useAppStore.getState().navigate('onboarding')
      })

      return () => {
        cleanupMonitorClosed()
        cleanupForceLogout()
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
        } catch (e) { }

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
    let unsubscribe = () => { }

    const setupListener = async () => {
      let screenId = displayId
      try {
        const { getStoredScreenId } = await import('@/services/DeviceSyncService')
        screenId = getStoredScreenId(displayId)
      } catch (e) { }

      if (!isSubscribed) return

      let isInitialSnapshot = true

      const screenRef = doc(db, 'screens', screenId)
      unsubscribe = onSnapshot(screenRef, (snapshot) => {
        if (!snapshot.exists()) return

        const data = snapshot.data()

        // Keep screenName updated in localStorage variableDevice
        if (data?.screenName) {
          try {
            const stored = localStorage.getItem('variableDevice')
            if (stored) {
              const variableDevice = JSON.parse(stored)
              if (variableDevice.screens) {
                const screenIdx = variableDevice.screens.findIndex((s: any) => s.displayId === displayId)
                if (screenIdx !== -1 && variableDevice.screens[screenIdx].screenName !== data.screenName) {
                  variableDevice.screens[screenIdx].screenName = data.screenName
                  localStorage.setItem('variableDevice', JSON.stringify(variableDevice))
                  console.log('[App] Updated screenName in localStorage:', data.screenName)
                }
              }
            }
          } catch (e) {
            console.error('Failed to sync screenName to localStorage:', e)
          }
        }

        const playlistId = data?.nowPlayingPlaylistId

        if (isInitialSnapshot) {
          isInitialSnapshot = false
          if (!playlistId) {
            return
          }
        }

        const state = useAppStore.getState()
        const currentSelectedPlaylist = state.selectedPlaylist

        if (!playlistId) {
          const currentMonitorId = state.selectedMonitorId
          if (currentMonitorId) {
            const storedStr = localStorage.getItem('monitorAssignments')
            const assignments = storedStr ? JSON.parse(storedStr) : {}
            assignments[currentMonitorId] = null
            localStorage.setItem('monitorAssignments', JSON.stringify(assignments))
            state.setMonitorAssignments(assignments)
          }
          state.setSelectedPlaylist(null)
          state.navigate('inactive')
          return
        }

        const freshCurrentView = state.currentView

        // If already playing this playlist, ignore
        if (playlistId === currentSelectedPlaylist?.id && freshCurrentView === 'player') return

        let attempts = 0
        const maxAttempts = 4 // up to 1 minute (4 * 15s)

        const tryFetch = async () => {
          try {
            const baseUrl = 'https://tabrevolver.variabl.co'
            const deviceToken = useAuthStore.getState().deviceToken
            if (!deviceToken) return

            const updatedPlaylists = await window.electronAPI.invoke('fetch-playlists', baseUrl, deviceToken)
            const targetPlaylist = updatedPlaylists.find((p: any) => p.id === playlistId)

            if (targetPlaylist) {
              console.log(`[RemoteControl] Found playlist ${playlistId}, starting playback.`)
              
              const currentMonitorId = state.selectedMonitorId
              if (currentMonitorId) {
                const storedStr = localStorage.getItem('monitorAssignments')
                const assignments = storedStr ? JSON.parse(storedStr) : {}
                assignments[currentMonitorId] = targetPlaylist
                localStorage.setItem('monitorAssignments', JSON.stringify(assignments))
                state.setMonitorAssignments(assignments)
              }
              
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
            setTimeout(tryFetch, 15000)
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

  // Multi-listener for decentralized window revival (All Windows)
  useEffect(() => {
    if (currentView === 'onboarding') return

    let isSubscribed = true
    const unsubs: (() => void)[] = []

    const setupMultiListener = async () => {
      try {
        const monitors = await window.electronAPI.invoke('get-monitors')
        const { getStoredScreenId } = await import('@/services/DeviceSyncService')

        for (const monitor of monitors) {
          // Skip the current window's monitor since its own single-listener handles it
          if (monitor.id === useAppStore.getState().selectedMonitorId) continue

          const screenId = getStoredScreenId(monitor.id.toString())
          if (!screenId) continue

          const unsub = onSnapshot(doc(db, 'screens', screenId), async (snapshot) => {
            if (!isSubscribed || !snapshot.exists()) return

            const data = snapshot.data()
            const playlistId = data?.nowPlayingPlaylistId

            if (!playlistId) return

            const state = useAppStore.getState()

            // Check current assignments
            const storedStr = localStorage.getItem('monitorAssignments')
            const assignments = storedStr ? JSON.parse(storedStr) : {}

            // If it's already assigned correctly, do nothing
            if (assignments[monitor.id]?.id === playlistId) return

            console.log(`[MultiListener] Detected remote assignment ${playlistId} for monitor ${monitor.id}`)

            let attempts = 0
            const maxAttempts = 4 // up to 1 minute (4 * 15s)

            const tryFetchMulti = async () => {
              const baseUrl = 'https://tabrevolver.variabl.co'
              const deviceToken = useAuthStore.getState().deviceToken
              if (!deviceToken) return

              try {
                const updatedPlaylists = await window.electronAPI.invoke('fetch-playlists', baseUrl, deviceToken)
                const targetPlaylist = updatedPlaylists.find((p: any) => p.id === playlistId)

                if (targetPlaylist) {
                  assignments[monitor.id] = targetPlaylist
                  localStorage.setItem('monitorAssignments', JSON.stringify(assignments))
                  state.setMonitorAssignments(assignments)

                  if (monitor.isPrimary) {
                    window.electronAPI.invoke('ensure-primary-window').catch(console.error)
                  } else {
                    window.electronAPI.invoke('start-secondary-players', assignments).catch(console.error)
                  }
                  return
                }
              } catch (err: any) {
                if (err.message?.includes('401')) {
                  const newToken = await useAuthStore.getState().refreshAuthToken()
                  if (newToken) {
                    try {
                      const retryPlaylists = await window.electronAPI.invoke('fetch-playlists', baseUrl, newToken)
                      const targetPlaylist = retryPlaylists.find((p: any) => p.id === playlistId)
                      if (targetPlaylist) {
                        assignments[monitor.id] = targetPlaylist
                        localStorage.setItem('monitorAssignments', JSON.stringify(assignments))
                        state.setMonitorAssignments(assignments)

                        if (monitor.isPrimary) {
                          window.electronAPI.invoke('ensure-primary-window').catch(console.error)
                        } else {
                          window.electronAPI.invoke('start-secondary-players', assignments).catch(console.error)
                        }
                        return
                      }
                    } catch (retryErr) {
                      console.error('[MultiListener] Retry fetch failed', retryErr)
                    }
                  }
                }
              }

              attempts++
              if (attempts < maxAttempts) {
                console.log(`[MultiListener] Playlist ${playlistId} not found, retrying... (${attempts}/${maxAttempts})`)
                setTimeout(tryFetchMulti, 15000)
              } else {
                console.warn(`[MultiListener] Could not find playlist ${playlistId} for monitor ${monitor.id} after 1 minute.`)
              }
            }

            tryFetchMulti()
          })
          unsubs.push(unsub)
        }
      } catch (e) {
        console.error('[MultiListener] Error setting up listeners:', e)
      }
    }

    setupMultiListener()

    return () => {
      isSubscribed = false
      unsubs.forEach(unsub => unsub())
    }
  }, [currentView])




  const Screen = SCREENS[currentView]
  return (
    <>
      <Screen />



      {/* Subtle Toast Banner for Admin Interfaces (when > 6s remaining) */}
      {isUpdateReady && updateCountdown > 6 && currentView !== 'player' && (
        <div className="fixed bottom-4 right-4 z-[9999] bg-slate-900 text-white px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-500 border border-slate-700/50">
          <div className="flex flex-col">
            <span className="font-medium text-[0.8rem]">Update downloaded</span>
          </div>
          <button
            onClick={() => window.electronAPI.invoke('install-update')}
            className="bg-white text-slate-900 px-3 py-1.5 rounded-md text-[0.75rem] font-semibold hover:bg-slate-100 transition-colors active:scale-95"
          >
            Restart Now
          </button>
        </div>
      )}

      {/* Massive Universal Warning Overlay (last 6s) */}
      {isUpdateReady && updateCountdown <= 6 && (
        <div className="fixed inset-0 z-[10000] bg-white/90 flex flex-col items-center justify-center animate-in fade-in duration-500 backdrop-blur-md">
          <div className="absolute top-12 text-slate-500 text-xl font-mono tracking-widest">
            00:{updateCountdown.toString().padStart(2, '0')}
          </div>
          <h1 className="text-3xl md:text-4xl text-slate-900 font-bold tracking-tight mb-3 text-center">
            Applying Update
          </h1>
          <p className="text-slate-600 text-sm md:text-base text-center max-w-sm px-6 leading-relaxed">
            Variabl will install the update and restart. This may take a few minutes. Restarting in <strong className="text-slate-900 font-bold">{updateCountdown}</strong> seconds...
          </p>
          <button
            onClick={() => window.electronAPI.invoke('install-update')}
            className="mt-6 bg-slate-950 text-white hover:bg-slate-800 px-6 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95 shadow-sm"
          >
            Restart Now
          </button>
        </div>
      )}
    </>
  )
}

export default App
