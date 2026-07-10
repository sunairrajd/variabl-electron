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

const applyWebviewSettings = (wv: any, tab: PlaylistTab) => {
  if (!wv || !tab) return;
  try {
    const zoomLevel = tab.zoom || 1;
    wv.executeJavaScript(`document.documentElement.style.zoom = '${zoomLevel}';`).catch(() => {})

    const disableScrollJS = `
      window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
      window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
      
      if (!window._variablCursorIdle) {
        window._variablCursorIdle = true;
        let cursorTimer = null;
        const styleEl = document.createElement('style');
        styleEl.innerHTML = '* { cursor: none !important; }';
        let isHidden = false;

        const hideCursor = () => {
          if (!isHidden) {
            document.head.appendChild(styleEl);
            isHidden = true;
          }
        };

        const showCursor = () => {
          if (isHidden) {
            if (document.head.contains(styleEl)) document.head.removeChild(styleEl);
            isHidden = false;
          }
          clearTimeout(cursorTimer);
          cursorTimer = setTimeout(hideCursor, 3000);
        };

        let lastMove = 0;
        const throttledShowCursor = (e) => {
          const now = Date.now();
          if (now - lastMove > 200) {
            lastMove = now;
            showCursor();
          }
        };

        window.addEventListener('mousemove', throttledShowCursor);
        window.addEventListener('mousedown', showCursor);
        window.addEventListener('touchstart', showCursor);
        window.addEventListener('keydown', showCursor);
        cursorTimer = setTimeout(hideCursor, 3000);
      }
      
      const style = document.createElement('style');
      style.innerHTML = '::-webkit-scrollbar { display: none !important; }';
      document.head.appendChild(style);
    `
    wv.executeJavaScript(disableScrollJS).catch(() => {})

    if (tab.scroll?.enabled && tab.scroll?.position) {
      wv.executeJavaScript(`window.scrollTo({ top: ${tab.scroll.position}, behavior: 'instant' })`).catch(() => {})
    }
  } catch (err) {
    // Suppress synchronous errors caused by calling executeJavaScript before dom-ready
  }
}


export default function PlayerScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const selectedPlaylist = useAppStore((s) => s.selectedPlaylist)
  const displayId = useAuthStore((s) => s.displayId)
  const userId = useAuthStore((s) => s.firebaseUser?.uid)
  const selectedMonitorId = useAppStore((s) => s.selectedMonitorId)
  const [isScreenLandscape, setIsScreenLandscape] = useState(window.innerWidth > window.innerHeight)

  useEffect(() => {
    const handleResize = () => {
      setIsScreenLandscape(window.innerWidth > window.innerHeight)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isPortraitPlaylist = selectedPlaylist?.orientation === 'portrait'
  const shouldRotate = isPortraitPlaylist && isScreenLandscape

  const rotateStyles: React.CSSProperties = shouldRotate ? {
    width: '100vh',
    height: '100vw',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%) rotate(90deg)',
    transformOrigin: 'center',
  } : {
    width: '100%',
    height: '100%',
    position: 'absolute',
    inset: 0,
  }

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

  const isInitialSnapshotRef = useRef(true)

  useEffect(() => {
    if (!selectedPlaylist?.id || !userId) return

    isInitialSnapshotRef.current = true
    const playlistRef = doc(db, 'playlists', selectedPlaylist.id)
    const unsubscribe = onSnapshot(playlistRef, async (snapshot) => {
      if (!snapshot.exists()) return

      // Skip the initial snapshot since we already have the latest playlist on mount
      if (isInitialSnapshotRef.current) {
        isInitialSnapshotRef.current = false
        return
      }

      console.log(`[PlayerScreen] Playlist document updated, fetching latest playlists...`)
      try {
        const baseUrl = 'https://tabrevolver.variabl.co'
        const deviceToken = useAuthStore.getState().deviceToken
        if (!deviceToken) return

        const updatedPlaylists = await window.electronAPI.invoke('fetch-playlists', baseUrl, deviceToken)
        const freshPlaylist = updatedPlaylists.find((p: any) => p.id === selectedPlaylist.id)
        if (freshPlaylist) {
          console.log('[PlayerScreen] Playlist fetched, staging update for next loop...')
          pendingPlaylistUpdateRef.current = freshPlaylist
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

  const webviewRefs = useRef<Map<number, any>>(new Map())
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const preloadTimerRef = useRef<NodeJS.Timeout | null>(null)
  const backgroundTabReadyRef = useRef(false)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null)
  const [loadedIndices, setLoadedIndices] = useState<Set<number>>(new Set())
  const [isPaused, setIsPaused] = useState(false)

  const transitionDuration = selectedPlaylist?.transition?.duration ?? 1000

  const changeViewWithTransition = (nextIndex: number) => {
    setIncomingIndex(nextIndex)
    setCurrentIndex(nextIndex)
    setIsRotating(false)

    setTimeout(() => {
      setIncomingIndex(null)
    }, transitionDuration + 50)
  }
  const initialSkipState = useAppStore.getState().skipCountdown
  const [firstTabLoaded, setFirstTabLoaded] = useState(initialSkipState)
  const [countdown, setCountdown] = useState(initialSkipState ? 0 : 5)
  const [forceReloadKey, setForceReloadKey] = useState(Date.now())
  const [isCursorVisible, setIsCursorVisible] = useState(true)



  const onReadyCallbackRef = useRef<(() => void) | null>(null)
  const onFailCallbackRef = useRef<(() => void) | null>(null)
  const cursorTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let lastMove = 0
    const handleActivity = () => {
      const now = Date.now()
      if (now - lastMove > 200) {
        lastMove = now
        setIsCursorVisible(true)
        if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current)
        cursorTimerRef.current = setTimeout(() => {
          setIsCursorVisible(false)
        }, 3000)
      }
    }

    handleActivity() // Initialize

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('mousedown', handleActivity)
    window.addEventListener('touchstart', handleActivity)
    window.addEventListener('keydown', handleActivity)

    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('mousedown', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current)
    }
  }, [])

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
      setCountdown(shouldSkip ? 0 : 5)
      setFirstTabLoaded(shouldSkip)
      setCurrentIndex(0)
      setIncomingIndex(null)
      setLoadedIndices(new Set())
      webviewRefs.current.clear()
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
  }, [forceReloadKey])

  // Report player-ready state when component mounts, or when monitorId / reload key changes
  useEffect(() => {
    setCountdown(5)
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

    setLoadedIndices(new Set([0, selectedPlaylist.tabs.length > 1 ? 1 : 0]))

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

    setCountdown(5)

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
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      
      // If still in countdown phase, only allow exit keys
      if (countdown > 0) {
        if (key === 'escape' || key === 'q' || key === 'backspace') {
          handleExit()
        }
        return
      }

      // Playback phase controls
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        setIsPaused((p) => !p)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      } else if (key === 'escape') {
        e.preventDefault()
        handleExit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [countdown, firstTabLoaded, currentIndex, isPaused, selectedPlaylist])
  const handleScroll = (deltaY: number) => {
    const wv = webviewRefs.current.get(currentIndex)
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

  useEffect(() => {
    const toggleVideo = (wv: any, play: boolean) => {
      if (!wv || !wv.executeJavaScript) return
      const script = play ? `
        (function() {
          const v = document.querySelector('video');
          if (v) v.play();
          else {
            const btn = document.querySelector('.ytp-play-button');
            if (btn && btn.getAttribute('aria-label') !== 'Pause') btn.click();
          }
        })();
      ` : `
        (function() {
          const v = document.querySelector('video');
          if (v) v.pause();
          else {
            const btn = document.querySelector('.ytp-play-button');
            if (btn && btn.getAttribute('aria-label') === 'Pause') btn.click();
          }
        })();
      `
      
      const tryExecute = () => {
        try {
          if (wv && wv.executeJavaScript) {
            wv.executeJavaScript(script).catch(() => {})
          }
        } catch (e) {}
      }

      // Try immediately and a few times after to catch lazy-loaded videos
      tryExecute()
      setTimeout(tryExecute, 1000)
      setTimeout(tryExecute, 3000)
      setTimeout(tryExecute, 5000)
    }

    Array.from(webviewRefs.current.entries()).forEach(([index, wv]) => {
      const shouldPlay = index === currentIndex && firstTabLoaded && !isPaused;
      toggleVideo(wv, shouldPlay);
    });
  }, [currentIndex, firstTabLoaded, isPaused])

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

      const wv = webviewRefs.current.get(currentIndex)
      if (wv) {
        wv.executeJavaScript(`document.documentElement.style.zoom = '${factor}';`).catch(console.error)
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
  const currentRotationIdRef = useRef<number>(0)

  const triggerRotation = (nextIndex: number, force = false) => {
    const rotationId = Date.now()
    currentRotationIdRef.current = rotationId

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
    setIncomingIndex(nextIndex)
    setLoadedIndices(prev => new Set(prev).add(nextIndex))

    // Clear the auto-rotation timer immediately
    if (timerRef.current) clearTimeout(timerRef.current)

    // Clear any pending fallback timeout from a previous forced rotation
    if (rotationTimeoutRef.current) {
      clearTimeout(rotationTimeoutRef.current)
      rotationTimeoutRef.current = null
    }

    if (isWebsiteTab(nextTab)) {
      const wv = webviewRefs.current.get(nextIndex)

      if (wv) {
        if (nextTab.reloadOnRotate) {
          try { wv.reload() } catch (e) {}
        }
        applyWebviewSettings(wv, nextTab)
        
        setTimeout(() => {
          if (currentRotationIdRef.current !== rotationId) return
          changeViewWithTransition(nextIndex)
        }, 100)
      } else {
        // If webview doesn't exist yet, it will mount now due to loadedIndices update.
        // We will just transition to it after a short delay to allow it to render.
        rotationTimeoutRef.current = setTimeout(() => {
          if (currentRotationIdRef.current !== rotationId) return
          changeViewWithTransition(nextIndex)
        }, 1000)
      }
    } else {
      // Internal Renderer
      if (backgroundTabReadyRef.current) {
        if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current)
        setTimeout(() => {
          if (currentRotationIdRef.current !== rotationId) return
          setCurrentIndex(nextIndex)
          setIncomingIndex(null)
          setIsRotating(false)
        }, 100)
        return
      }

      onReadyCallbackRef.current = () => {
        if (currentRotationIdRef.current !== rotationId) return
        if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current)
        setTimeout(() => {
          if (currentRotationIdRef.current !== rotationId) return
          changeViewWithTransition(nextIndex)
        }, 100)
      }

      onFailCallbackRef.current = () => {
        if (currentRotationIdRef.current !== rotationId) return
        if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current)
        changeViewWithTransition(nextIndex)
        setTimeout(() => {
          const skipIndex = (nextIndex + 1) % actualPlaylist.tabs.length
          triggerRotation(skipIndex, true)
        }, 2000)
      }

      rotationTimeoutRef.current = setTimeout(() => {
        if (currentRotationIdRef.current !== rotationId) return
        if (onFailCallbackRef.current) onFailCallbackRef.current()
      }, 5000)
    }
  }

  useEffect(() => {
    if (!selectedPlaylist?.tabs || selectedPlaylist.tabs.length === 0) return
    if (isPaused || isRotating || !firstTabLoaded || isCursorVisible) return

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

      setIncomingIndex(nextIndex)

      if (isWebsiteTab(nextTab)) {
        backgroundTabReadyRef.current = false
        const isAlreadyPreloaded = loadedIndices.has(nextIndex)

        setLoadedIndices(prev => {
          if (prev.has(nextIndex)) return prev;
          return new Set(prev).add(nextIndex);
        })

        if (isAlreadyPreloaded && nextTab.reloadOnRotate) {
          const wv = webviewRefs.current.get(nextIndex)
          try { if (wv) wv.reload() } catch(e) {}
        }

        if (isAlreadyPreloaded) {
          backgroundTabReadyRef.current = true
        }
      } else {
        const isAlreadyPreloaded = loadedIndices.has(nextIndex)
        setLoadedIndices(prev => {
          if (prev.has(nextIndex)) return prev;
          return new Set(prev).add(nextIndex);
        })
        backgroundTabReadyRef.current = isAlreadyPreloaded
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
  }, [currentIndex, isPaused, selectedPlaylist, isRotating, firstTabLoaded, isCursorVisible])

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

  const transitionType = selectedPlaylist?.transition?.type || 'fade'

  const getTransitionStyle = (viewIndex: number): React.CSSProperties => {
    const isCurrent = currentIndex === viewIndex
    const isIncoming = incomingIndex === viewIndex

    let translateX = '0%'
    let duration = transitionDuration

    if (transitionType === 'slide') {
      if (isCurrent) {
        translateX = '0%'
      } else if (isIncoming) {
        translateX = '100%'
        duration = 0 // snap instantly to the right side of the screen
      } else {
        translateX = '-100%'
      }
    }

    const durationStr = `${duration}ms`

    const baseStyle: React.CSSProperties = {
      transitionProperty: transitionType === 'slide' ? 'transform' : 'opacity',
      transitionDuration: durationStr,
      transitionTimingFunction: 'ease-in-out',
    }

    if (transitionType === 'slide') {
      return {
        ...baseStyle,
        transform: `translateX(${translateX})`,
        opacity: 1,
        zIndex: isCurrent ? 10 : 0,
        pointerEvents: isCurrent ? 'auto' : 'none',
      }
    } else {
      return {
        ...baseStyle,
        opacity: isCurrent ? 1 : 0,
        transform: 'none',
        zIndex: isCurrent ? 10 : 0,
        pointerEvents: isCurrent ? 'auto' : 'none',
      }
    }
  }

  return (
    <div className={`relative w-screen h-screen bg-black overflow-hidden select-none ${!isCursorVisible ? 'cursor-none' : ''}`}>
      <div style={rotateStyles}>
        <div className="absolute inset-0 h-full w-full">
          {selectedPlaylist?.tabs?.map((tab, index) => {
            if (!loadedIndices.has(index)) return null;

            const isWebsite = isWebsiteTab(tab);
            const safeUrl = tab.url?.startsWith('http') ? tab.url : `https://${tab.url}`;

            return (
              <div 
                key={`tab-${index}-${forceReloadKey}`}
                className="absolute inset-0 h-full w-full"
                style={getTransitionStyle(index)}
              >
                {isWebsite ? (
                  <webview
                    ref={(el) => { 
                      if (el) {
                        webviewRefs.current.set(index, el)
                        if (index === currentIndex) applyWebviewSettings(el, tab)
                        
                        el.addEventListener('did-finish-load', () => {
                           if (index === currentIndex) applyWebviewSettings(el, tab)
                        })
                      }
                    }}
                    allowpopups={"true" as any}
                    src={safeUrl}
                    className="absolute inset-0 h-full w-full bg-white"
                  />
                ) : (
                  <RendererContainer
                    tab={tab}
                    isActive={currentIndex === index}
                    isPaused={isPaused || !firstTabLoaded}
                    onFinish={handleNext}
                    onReady={() => {
                      if (currentIndex !== index) {
                        backgroundTabReadyRef.current = true
                        onReadyCallbackRef.current?.()
                      }
                    }}
                    onFail={() => {
                      if (currentIndex !== index) {
                        backgroundTabReadyRef.current = true
                        onFailCallbackRef.current?.()
                      }
                    }}
                  />
                )}
              </div>
            );
          })}
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
    </div>
  )
}
