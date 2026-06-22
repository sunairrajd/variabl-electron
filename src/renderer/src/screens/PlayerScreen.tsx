import { useEffect, useRef, useState } from 'react'
import { useAppStore, PlaylistTab, Playlist } from '@/stores/useAppStore'
import { Loader2, Smartphone } from 'lucide-react'
import PlayerOverlayScreen from './PlayerOverlayScreen'
import { SyncService } from '@/services/SyncService'
import RendererContainer from '@/components/renderers/RendererContainer'
import { db, doc, updateDoc, onSnapshot } from '@/lib/firebase'
import { useAuthStore } from '@/stores/useAuthStore'
import { GradientWaveText } from '@/components/ui/gradient-wave-text'

const isWebsiteTab = (tab: PlaylistTab | null) => {
  if (!tab) return true;
  const isYoutube = tab.type === 'youtube' ||
    tab.faviconURL?.includes('youtube.com') ||
    tab.url?.includes('youtube.com') ||
    tab.url?.includes('youtu.be');
  return !['youtube', 'image', 'message', 'announcement', 'gsheet'].includes(tab.type) && !isYoutube;
}

export default function PlayerScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const selectedPlaylist = useAppStore((s) => s.selectedPlaylist)
  const displayId = useAuthStore((s) => s.displayId)
  const userId = useAuthStore((s) => s.firebaseUser?.uid)
  const selectedMonitorId = useAppStore((s) => s.selectedMonitorId)
  const webviewARef = useRef<any>(null)

  useEffect(() => {
    if (!displayId || !selectedPlaylist?.id || !userId) return

    const updateNowPlaying = async (playlistId: string) => {
      try {
        const { getStoredScreenId } = await import('@/services/DeviceSyncService')
        const screenId = getStoredScreenId(displayId)

        await updateDoc(doc(db, 'screens', screenId), {
          nowPlayingPlaylistId: playlistId,
          updatedAt: Date.now()
        })
        console.log(`[PlayerScreen] Updated nowPlayingPlaylistId to ${playlistId} in Firestore`)
      } catch (err) {
        console.error('[PlayerScreen] Failed to update nowPlayingPlaylistId in Firestore:', err)
      }
    }

    updateNowPlaying(selectedPlaylist.id)
  }, [displayId, selectedPlaylist?.id, userId])

  const pendingPlaylistUpdateRef = useRef<Playlist | null>(null)

  useEffect(() => {
    if (!selectedPlaylist?.id || !userId) return

    const playlistRef = doc(db, 'playlists', selectedPlaylist.id)
    const unsubscribe = onSnapshot(playlistRef, async (snapshot) => {
      if (!snapshot.exists()) return

      console.log(`[PlayerScreen] Playlist document updated, fetching latest playlists...`)
      try {
        const baseUrl = 'https://tabrevolver.variabl.co'
        const deviceToken = useAuthStore.getState().deviceToken
        if (!deviceToken) return

        const updatedPlaylists = await window.electronAPI.invoke('fetch-playlists', baseUrl, deviceToken)
        const freshPlaylist = updatedPlaylists.find((p: any) => p.id === selectedPlaylist.id)
        if (freshPlaylist) {
          console.log('[PlayerScreen] Playlist fetched, instantly switching to new contents...')
          setSelectedPlaylist(freshPlaylist)

          // Clear staging variable just in case
          pendingPlaylistUpdateRef.current = null

          // Clear any pending rotation timeouts so the old playlist doesn't accidentally trigger
          if (timerRef.current) clearTimeout(timerRef.current)
          if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current)
          if (preloadTimerRef.current) clearTimeout(preloadTimerRef.current)

          // Reset core player state for a fresh start
          setCountdown(10)
          setFirstTabLoaded(false)
          setCurrentIndex(0)
          setActiveView(0)
          setIsRotating(false)

          // Trigger the initialization useEffect
          setForceReloadKey(Date.now())
          console.log(`[PlayerScreen Debug] Instant switch triggered. Countdown set to 10, firstTabLoaded=false. forceReloadKey bumped.`)
        }
      } catch (err: any) {
        console.error('[PlayerScreen] Failed to fetch updated playlist:', err)
        if (err.message?.includes('401')) {
          const newToken = await useAuthStore.getState().refreshAuthToken()
          if (!newToken) {
            useAuthStore.getState().logout()
            navigate('onboarding')
          }
        }
      }
    })

    return () => unsubscribe()
  }, [selectedPlaylist?.id, userId])

  const webviewBRef = useRef<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const preloadTimerRef = useRef<NodeJS.Timeout | null>(null)
  const backgroundTabReadyRef = useRef(false)

  const [activeView, setActiveView] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [urlA, setUrlA] = useState<string>('')
  const [urlB, setUrlB] = useState<string>('')
  const [tabA, setTabA] = useState<PlaylistTab | null>(null)
  const [tabB, setTabB] = useState<PlaylistTab | null>(null)
  const [renderKeyA, setRenderKeyA] = useState<number>(Date.now())
  const [renderKeyB, setRenderKeyB] = useState<number>(Date.now())
  const [isPaused, setIsPaused] = useState(false)
  const initialSkipState = useAppStore.getState().skipCountdown
  const [firstTabLoaded, setFirstTabLoaded] = useState(initialSkipState)
  const [countdown, setCountdown] = useState(initialSkipState ? 0 : 10)
  const [forceReloadKey, setForceReloadKey] = useState(Date.now())

  const onReadyCallbackRef = useRef<(() => void) | null>(null)
  const onFailCallbackRef = useRef<(() => void) | null>(null)

  const handleExit = async () => {
    const searchParams = new URLSearchParams(window.location.search)
    const isSecondary = searchParams.has('monitorId')

    navigate('inactive')

    if (displayId) {
      import('@/services/DeviceSyncService').then(({ getStoredScreenId }) => {
        const screenId = getStoredScreenId(displayId)
        updateDoc(doc(db, 'screens', screenId), {
          nowPlayingPlaylistId: "",
          updatedAt: Date.now()
        }).catch((err) => {
          console.error('[PlayerScreen] Failed to clear nowPlayingPlaylistId on exit:', err)
        })
      })
    }

    // Update local assignment and sync to API
    try {
      const selectedMonitorId = useAppStore.getState().selectedMonitorId
      if (selectedMonitorId) {
        const storedStr = localStorage.getItem('monitorAssignments')
        if (storedStr) {
          const assignments = JSON.parse(storedStr)
          assignments[selectedMonitorId] = null
          localStorage.setItem('monitorAssignments', JSON.stringify(assignments))
          useAppStore.getState().setMonitorAssignments(assignments)

          const monitors = await window.electronAPI.invoke('get-monitors')
          const { syncDeviceAndScreens } = await import('@/services/DeviceSyncService')
          syncDeviceAndScreens(monitors, assignments)
        }
      }
    } catch (e) {
      console.error('Failed to sync null assignment on exit:', e)
    }
  }

  const initialSkip = useAppStore.getState().skipCountdown
  const [countdownStarted, setCountdownStarted] = useState(initialSkip)

  // Reset player state when a COMPLETELY DIFFERENT playlist is selected
  const previousPlaylistIdRef = useRef<string | undefined>(selectedPlaylist?.id)

  useEffect(() => {
    if (selectedPlaylist?.id && selectedPlaylist.id !== previousPlaylistIdRef.current) {
      console.log(`[PlayerScreen] Playlist changed from ${previousPlaylistIdRef.current} to ${selectedPlaylist.id}. Resetting player state.`)
      previousPlaylistIdRef.current = selectedPlaylist.id


      if (timerRef.current) clearTimeout(timerRef.current)
      if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current)
      if (preloadTimerRef.current) clearTimeout(preloadTimerRef.current)

      const shouldSkip = useAppStore.getState().skipCountdown

      // Reset core player state for a fresh start
      setCountdownStarted(shouldSkip)
      setCountdown(shouldSkip ? 0 : 10)
      setFirstTabLoaded(shouldSkip)
      setCurrentIndex(0)
      setActiveView(0)
      setIsRotating(false)
      setForceReloadKey(Date.now())
    }
  }, [selectedPlaylist?.id])

  // Listen for the start-countdown event from main process, with a 5-second fallback
  useEffect(() => {
    const cleanup = window.electronAPI.on('start-countdown', () => {
      console.log('[PlayerScreen] start-countdown event received from main process')
      setCountdownStarted(true)
    })
    
    // Fallback: If IPC is lost or delayed, force start after 5 seconds
    const fallbackTimer = setTimeout(() => {
      console.log('[PlayerScreen] start-countdown fallback triggered')
      setCountdownStarted(true)
    }, 5000)

    return () => {
      cleanup()
      clearTimeout(fallbackTimer)
    }
  }, [])

  // Report player-ready state when component mounts, or when monitorId / reload key changes
  useEffect(() => {
    setCountdownStarted(false)
    if (selectedMonitorId) {
      console.log(`[PlayerScreen] Reporting player-ready for monitor ${selectedMonitorId}`)
      window.electronAPI.invoke('player-ready', selectedMonitorId).catch(console.error)
    }
  }, [selectedMonitorId, forceReloadKey])

  useEffect(() => {
    if (!selectedPlaylist) return undefined
    if (!countdownStarted) return undefined

    if (!selectedPlaylist.tabs || selectedPlaylist.tabs.length === 0) {
      setCountdown(0)
      setFirstTabLoaded(true)

      // Enter kiosk mode even if empty
      window.electronAPI.invoke('toggle-kiosk', true).catch(err => {
        console.error(`[PlayerScreen] Error attempting to enable kiosk mode: ${err.message}`)
      })

      return undefined
    }

    const initialTab = selectedPlaylist.tabs[0]
    setTabA(initialTab)
    setRenderKeyA(Date.now())

    if (isWebsiteTab(initialTab)) {
      const initialUrl = initialTab.url.startsWith('http')
        ? initialTab.url
        : `https://${initialTab.url}`
      setUrlA(initialUrl)
    }

    // Preload the second tab if it exists
    if (selectedPlaylist.tabs.length > 1) {
      const secondTab = selectedPlaylist.tabs[1]
      setTabB(secondTab)
      setRenderKeyB(Date.now())
      if (isWebsiteTab(secondTab)) {
        const secondUrl = secondTab.url.startsWith('http')
          ? secondTab.url
          : `https://${secondTab.url}`
        setUrlB(secondUrl)
      }
    }

    const shouldSkip = useAppStore.getState().skipCountdown

    if (shouldSkip) {
      setCountdown(0)
      setFirstTabLoaded(true)
      useAppStore.getState().setSkipCountdown(false) // reset for next time

      window.electronAPI.invoke('toggle-kiosk', true).catch(err => {
        console.error(`[PlayerScreen] Error attempting to enable kiosk mode: ${err.message}`)
      })
      return undefined
    }

    setCountdown(10)

    // Enter kiosk mode immediately when countdown begins
    window.electronAPI.invoke('toggle-kiosk', true).catch(err => {
      console.error(`[PlayerScreen] Error attempting to enable kiosk mode: ${err.message}`)
    })

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setFirstTabLoaded(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [selectedPlaylist?.id, forceReloadKey, countdownStarted])
  useEffect(() => {
    const cleanup = window.electronAPI.on('auth-window-state', (isOpen) => {
      setIsPaused(isOpen as boolean)
    })
    return cleanup
  }, [])

  const setSelectedPlaylist = useAppStore((s) => s.setSelectedPlaylist)

  useEffect(() => {
    if (countdown <= 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === 'escape' || key === 'q' || key === 'backspace') {
        handleExit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [countdown])
  const handleScroll = (deltaY: number) => {
    const wv = activeView === 0 ? webviewARef.current : webviewBRef.current
    if (wv) {
      wv.executeJavaScript(`window.scrollBy({ top: ${deltaY}, behavior: 'smooth' })`)

      // Update local state to remember scroll settings for this tab
      if (selectedPlaylist && selectedPlaylist.tabs) {
        const updatedTabs = [...selectedPlaylist.tabs]
        const currentTab = updatedTabs[currentIndex]

        const currentPosition = currentTab.scroll?.position || 0
        const updatedTab = {
          ...currentTab,
          scroll: {
            enabled: true,
            position: currentPosition + deltaY
          }
        }
        updatedTabs[currentIndex] = updatedTab
        const newPlaylist = { ...selectedPlaylist, tabs: updatedTabs }
        setSelectedPlaylist(newPlaylist)
        SyncService.syncPlaylistSettings(newPlaylist)
      }
    }
  }

  const handleSaveScroll = () => {
    if (selectedPlaylist && selectedPlaylist.tabs) {
      SyncService.syncPlaylistSettings(selectedPlaylist)
    }
  }

  const handleZoom = (factor: number) => {
    if (selectedPlaylist && selectedPlaylist.tabs) {
      const currentTab = selectedPlaylist.tabs[currentIndex]
      const updatedTab = { ...currentTab, zoom: factor }
      const updatedTabs = [...selectedPlaylist.tabs]

      const wv = activeView === 0 ? webviewARef.current : webviewBRef.current
      if (wv) {
        wv.setZoomFactor(factor)
        updatedTabs[currentIndex] = updatedTab
        const newPlaylist = { ...selectedPlaylist, tabs: updatedTabs }
        setSelectedPlaylist(newPlaylist)
        SyncService.syncPlaylistSettings(newPlaylist)
      }
    }
  }

  const handleSaveZoom = () => {
    if (selectedPlaylist && selectedPlaylist.tabs) {
      SyncService.syncPlaylistSettings(selectedPlaylist)
    }
  }

  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }

  const [isRotating, setIsRotating] = useState(false)
  const rotationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const triggerRotation = (nextIndex: number, force = false) => {
    const pendingUpdate = pendingPlaylistUpdateRef.current
    const actualPlaylist = (pendingUpdate && nextIndex === 0) ? pendingUpdate : selectedPlaylist

    if (!actualPlaylist?.tabs) return
    if (isRotating && !force) return // Prevent overlapping rotations unless forced (manual skip)

    if (pendingUpdate && nextIndex === 0) {
      setSelectedPlaylist(pendingUpdate)
      pendingPlaylistUpdateRef.current = null
      console.log('[PlayerScreen] Applied staged playlist update on new loop')
    }

    setIsRotating(true)

    const nextTab = actualPlaylist.tabs[nextIndex]
    if (!nextTab) {
      setIsRotating(false)
      return
    }
    const nextView = activeView === 0 ? 1 : 0
    const wv = nextView === 0 ? webviewARef.current : webviewBRef.current

    if (nextView === 0) {
      setTabA(nextTab)
      setRenderKeyA(Date.now())
    } else {
      setTabB(nextTab)
      setRenderKeyB(Date.now())
    }

    // Clear the auto-rotation timer immediately
    if (timerRef.current) clearTimeout(timerRef.current)

    // Clear any pending fallback timeout from a previous forced rotation
    if (rotationTimeoutRef.current) {
      clearTimeout(rotationTimeoutRef.current)
      rotationTimeoutRef.current = null
    }

    if (isWebsiteTab(nextTab)) {
      let safeUrl = nextTab.url.startsWith('http') ? nextTab.url : `https://${nextTab.url}`

      if (wv) {
        const applyTabSettings = () => {
          if (nextTab.zoom) wv.setZoomFactor(nextTab.zoom)
          else wv.setZoomFactor(1)

          const disableScrollJS = `
            window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
            window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
            const style = document.createElement('style');
            style.innerHTML = '::-webkit-scrollbar { display: none !important; }';
            document.head.appendChild(style);
          `
          wv.executeJavaScript(disableScrollJS).catch(console.error)

          if (nextTab.scroll?.enabled && nextTab.scroll?.position) {
            wv.executeJavaScript(`window.scrollTo({ top: ${nextTab.scroll.position}, behavior: 'instant' })`)
          }
        }

        const onFinishLoad = () => {
          if (rotationTimeoutRef.current) {
            clearTimeout(rotationTimeoutRef.current)
            rotationTimeoutRef.current = null
          }
          wv.removeEventListener('did-finish-load', onFinishLoad)
          wv.removeEventListener('did-fail-load', onFailLoad)

          applyTabSettings()
          setTimeout(() => {
            setActiveView(nextView)
            setCurrentIndex(nextIndex)
            setIsRotating(false)
          }, 100)
        }

        const onFailLoad = () => {
          if (rotationTimeoutRef.current) {
            clearTimeout(rotationTimeoutRef.current)
            rotationTimeoutRef.current = null
          }
          wv.removeEventListener('did-finish-load', onFinishLoad)
          wv.removeEventListener('did-fail-load', onFailLoad)

          applyTabSettings()
          setActiveView(nextView)
          setCurrentIndex(nextIndex)
          setIsRotating(false)
        }

        wv.addEventListener('did-finish-load', onFinishLoad)
        wv.addEventListener('did-fail-load', onFailLoad)

        rotationTimeoutRef.current = setTimeout(() => {
          wv.removeEventListener('did-finish-load', onFinishLoad)
          wv.removeEventListener('did-fail-load', onFailLoad)

          applyTabSettings()
          setActiveView(nextView)
          setCurrentIndex(nextIndex)
          setIsRotating(false)
        }, 3000)

        const isAlreadyLoaded = (nextView === 0 && urlA === safeUrl) || (nextView === 1 && urlB === safeUrl)

        if (!isAlreadyLoaded) {
          if (nextView === 0) setUrlA(safeUrl)
          else setUrlB(safeUrl)
        }

        if (isAlreadyLoaded) {
          applyTabSettings()
          setTimeout(() => {
            setActiveView(nextView)
            setCurrentIndex(nextIndex)
            setIsRotating(false)
          }, 100)
          return
        }

        /*
        try {
          wv.loadURL(safeUrl)
        } catch (e) {
          console.error('Failed to load URL directly:', e)
        }
        */

      } else {
        setActiveView(nextView)
        setCurrentIndex(nextIndex)
        if (nextView === 0) setUrlA(safeUrl)
        else setUrlB(safeUrl)
        setIsRotating(false)
      }
    } else {
      // Internal Renderer
      const isAlreadyPreloaded = (nextView === 0 && tabA === nextTab) || (nextView === 1 && tabB === nextTab)

      if (isAlreadyPreloaded && backgroundTabReadyRef.current) {
        if (rotationTimeoutRef.current) {
          clearTimeout(rotationTimeoutRef.current)
          rotationTimeoutRef.current = null
        }
        setTimeout(() => {
          setActiveView(nextView)
          setCurrentIndex(nextIndex)
          setIsRotating(false)
        }, 100)
        return
      }

      onReadyCallbackRef.current = () => {
        if (rotationTimeoutRef.current) {
          clearTimeout(rotationTimeoutRef.current)
          rotationTimeoutRef.current = null
        }
        setTimeout(() => {
          setActiveView(nextView)
          setCurrentIndex(nextIndex)
          setIsRotating(false)
        }, 100)
      }

      onFailCallbackRef.current = () => {
        if (rotationTimeoutRef.current) {
          clearTimeout(rotationTimeoutRef.current)
          rotationTimeoutRef.current = null
        }
        setActiveView(nextView)
        setCurrentIndex(nextIndex)
        setIsRotating(false)

        setTimeout(() => {
          const skipIndex = (nextIndex + 1) % actualPlaylist.tabs.length
          triggerRotation(skipIndex, true)
        }, 2000)
      }

      rotationTimeoutRef.current = setTimeout(() => {
        if (onFailCallbackRef.current) onFailCallbackRef.current()
      }, 5000)
    }
  }

  useEffect(() => {
    if (!selectedPlaylist?.tabs || selectedPlaylist.tabs.length === 0) return
    if (isPaused || isRotating || !firstTabLoaded) return

    const currentTab = selectedPlaylist.tabs[currentIndex]
    if (!currentTab) return

    const isFixed = selectedPlaylist.rotationType === 'fixed'

    const isYouTube = currentTab.type === 'youtube' || currentTab.faviconURL?.includes('youtube.com')

    const intervalMs = isYouTube
      ? (currentTab.interval || 30) * 1000
      : (isFixed
        ? (selectedPlaylist.defaultInterval || 30) * 1000
        : (currentTab.interval || selectedPlaylist.defaultInterval || 30) * 1000)

    // Ensure we wait at least 1500ms before preloading the next tab.
    // The previous view takes 1000ms to fade out. If we preload immediately (e.g., interval is small),
    // we would change the src of the fading-out webview, causing a visible flash of the next tab.
    const preloadMs = Math.max(1500, intervalMs - 5000)

    if (timerRef.current) clearTimeout(timerRef.current)
    if (preloadTimerRef.current) clearTimeout(preloadTimerRef.current)

    preloadTimerRef.current = setTimeout(() => {
      const nextIndex = (currentIndex + 1) % selectedPlaylist.tabs.length
      const nextTab = selectedPlaylist.tabs[nextIndex]
      const nextView = activeView === 0 ? 1 : 0

      if (isWebsiteTab(nextTab)) {
        backgroundTabReadyRef.current = false

        if (nextView === 0) {
          setTabA(nextTab)
          setRenderKeyA(Date.now())
        } else {
          setTabB(nextTab)
          setRenderKeyB(Date.now())
        }

        let safeUrl = nextTab.url.startsWith('http') ? nextTab.url : `https://${nextTab.url}`
        if (nextView === 0) setUrlA(safeUrl)
        else setUrlB(safeUrl)
      }
    }, preloadMs)

    timerRef.current = setTimeout(() => {
      const nextIndex = (currentIndex + 1) % selectedPlaylist.tabs.length
      triggerRotation(nextIndex)
    }, intervalMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (preloadTimerRef.current) clearTimeout(preloadTimerRef.current)
    }
  }, [currentIndex, isPaused, activeView, selectedPlaylist, isRotating, firstTabLoaded])

  const handleNext = () => {
    if (!selectedPlaylist?.tabs) return
    const nextIndex = (currentIndex + 1) % selectedPlaylist.tabs.length
    triggerRotation(nextIndex, true)
  }

  const handlePrev = () => {
    if (!selectedPlaylist?.tabs) return
    const prevIndex = (currentIndex - 1 + selectedPlaylist.tabs.length) % selectedPlaylist.tabs.length
    triggerRotation(prevIndex, true)
  }

  const determineCanScroll = (tab: PlaylistTab | null | undefined): boolean => {
    if (!tab) return true;
    const isUnscrollableType = ['youtube', 'image', 'announcement', 'message'].includes(tab.type);
    const isYouTubeUrl = tab.url?.includes('youtube.com') || tab.faviconURL?.includes('youtube.com');
    return !isUnscrollableType && !isYouTubeUrl;
  }

  const determineCanZoom = (tab: PlaylistTab | null | undefined): boolean => {
    return determineCanScroll(tab) && !tab?.url?.toLowerCase().includes('looker');
  }

  const currentTabToRender = selectedPlaylist?.tabs?.[currentIndex];
  const canScroll = determineCanScroll(currentTabToRender);
  const canZoom = determineCanZoom(currentTabToRender);

  const totalDurationSeconds = selectedPlaylist?.tabs?.reduce((acc, tab) => {
    const isYouTube = tab.type === 'youtube' || tab.faviconURL?.includes('youtube.com')
    const isFixed = selectedPlaylist?.rotationType === 'fixed'
    const interval = isYouTube
      ? (tab.interval || 30)
      : (isFixed
        ? (selectedPlaylist?.defaultInterval || 30)
        : (tab.interval || selectedPlaylist?.defaultInterval || 30))
    return acc + interval
  }, 0) || 0

  return (
    <div className="relative w-screen h-screen bg-white overflow-hidden select-none">
      <div className="absolute inset-0 h-full w-full">
        {isWebsiteTab(tabA) && (
          <webview
            key={`wv-a-${forceReloadKey}`}
            ref={(el) => { webviewARef.current = el }}
            allowpopups={"true" as any}
            src={urlA || undefined}
            className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 0 ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}
          />
        )}

        <div className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 0 && !isWebsiteTab(tabA) ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          {!isWebsiteTab(tabA) && (
            <RendererContainer
              key={renderKeyA}
              tab={tabA}
              isActive={activeView === 0}
              isPaused={isPaused || !firstTabLoaded}
              onFinish={handleNext}
              onReady={() => {
                if (activeView !== 0) {
                  backgroundTabReadyRef.current = true
                  onReadyCallbackRef.current?.()
                }
              }}
              onFail={() => {
                if (activeView !== 0) {
                  backgroundTabReadyRef.current = true
                  onFailCallbackRef.current?.()
                }
              }}
            />
          )}
        </div>

        {isWebsiteTab(tabB) && (
          <webview
            key={`wv-b-${forceReloadKey}`}
            ref={(el) => { webviewBRef.current = el }}
            allowpopups={"true" as any}
            src={urlB || undefined}
            className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 1 ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}
          />
        )}

        <div className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 1 && !isWebsiteTab(tabB) ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          {!isWebsiteTab(tabB) && (
            <RendererContainer
              key={renderKeyB}
              tab={tabB}
              isActive={activeView === 1}
              isPaused={isPaused || !firstTabLoaded}
              onFinish={handleNext}
              onReady={() => {
                if (activeView !== 1) {
                  backgroundTabReadyRef.current = true
                  onReadyCallbackRef.current?.()
                }
              }}
              onFail={() => {
                if (activeView !== 1) {
                  backgroundTabReadyRef.current = true
                  onFailCallbackRef.current?.()
                }
              }}
            />
          )}
        </div>
      </div>

      <div
        className={`absolute inset-0 flex flex-col items-center justify-center bg-black z-50 transition-opacity ease-in-out pointer-events-none ${firstTabLoaded ? 'opacity-0 duration-1000' : 'opacity-100 duration-0'
          }`}
      >
        <GradientWaveText
          className="text-xl font-medium mb-4 h-auto w-auto [--gradient-wave-base:rgb(255,255,255)]"
          customColors={["#DAFA51", "#3b82f6", "#8b5cf6"]}
          speed={1}
          repeat={true}
        >
          {selectedPlaylist ? (
            <>
              Activating display in <span className="text-lg font-mono">
                00:{countdown.toString().padStart(2, '0')}
              </span>
            </>
          ) : (
            'Waiting for playlist...'
          )}
        </GradientWaveText>
        <div className="flex items-center gap-2 text-white/50 text-[clamp(0.8rem,1vw,1rem)] font-light mt-2">
          <Smartphone className="w-[1.2em] h-[1.2em]" />
          <span>To control this screen remotely, visit <span className="text-white/80 font-medium">variabl.co/app</span></span>
        </div>
      </div>

      {firstTabLoaded && (
        <PlayerOverlayScreen
          playlistName={selectedPlaylist?.name || 'My Playlist'}
          tabs={selectedPlaylist?.tabs || []}
          currentIndex={currentIndex}
          currentTabName={selectedPlaylist?.tabs?.[currentIndex]?.title || selectedPlaylist?.tabs?.[currentIndex]?.url || ''}
          isPaused={isPaused}
          isNavigating={isRotating}
          onPause={() => setIsPaused(true)}
          onResume={() => setIsPaused(false)}
          onNext={handleNext}
          onPrev={handlePrev}
          onExit={handleExit}
          onScroll={handleScroll}
          onSaveScroll={handleSaveScroll}
          onZoom={handleZoom}
          onSaveZoom={handleSaveZoom}
          onFullscreenToggle={handleFullscreenToggle}
          canScroll={canScroll}
          canZoom={canZoom}
          durationSeconds={totalDurationSeconds}
        />
      )}
    </div>
  )
}
