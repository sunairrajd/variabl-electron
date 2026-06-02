import { useEffect, useRef, useState } from 'react'
import { useAppStore, PlaylistTab, Playlist } from '@/stores/useAppStore'
import { Loader2, Smartphone } from 'lucide-react'
import PlayerOverlayScreen from './PlayerOverlayScreen'
import { SyncService } from '@/services/SyncService'
import RendererContainer from '@/components/renderers/RendererContainer'
import { rtdb, rtdbRef, rtdbUpdate } from '@/lib/firebase'
import { onValue } from 'firebase/database'
import { useAuthStore } from '@/stores/useAuthStore'
import { GradientWaveText } from '@/components/ui/gradient-wave-text'

const isWebsiteTab = (tab: PlaylistTab | null) => {
  if (!tab) return true;
  return !['youtube', 'image', 'message', 'announcement', 'gsheet'].includes(tab.type) && !tab.faviconURL?.includes('youtube.com');
}

export default function PlayerScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const selectedPlaylist = useAppStore((s) => s.selectedPlaylist)
  const displayId = useAuthStore((s) => s.displayId)
  const userId = useAuthStore((s) => s.firebaseUser?.uid)
  const webviewARef = useRef<any>(null)

  useEffect(() => {
    if (!displayId || !selectedPlaylist?.id) return

    const updateNowPlaying = async (playlistId: string) => {
      try {
        await rtdbUpdate(rtdbRef(rtdb, `screens/${displayId}`), {
          nowPlayingPlaylistId: playlistId,
          updatedAt: Date.now()
        })
        console.log(`[PlayerScreen] Updated nowPlayingPlaylistId to ${playlistId}`)
      } catch (err) {
        console.error('[PlayerScreen] Failed to update nowPlayingPlaylistId in RTDB:', err)
      }
    }

    updateNowPlaying(selectedPlaylist.id)

    // Removed the cleanup function here that was setting nowPlayingPlaylistId to "".
    // Setting it to "" here causes race conditions with StrictMode or when switching playlists,
    // immediately triggering the remote control listener to navigate to the inactive screen.
  }, [displayId, selectedPlaylist?.id])

  const pendingPlaylistUpdateRef = useRef<Playlist | null>(null)

  useEffect(() => {
    if (!selectedPlaylist?.id || !userId) return

    const signalRef = rtdbRef(rtdb, `user_signals/${userId}/lastPlaylistUpdate`)
    const unsubscribe = onValue(signalRef, async (snapshot) => {
      const timestamp = snapshot.val()
      if (!timestamp) return

      console.log(`[PlayerScreen] Signal received at ${timestamp}, fetching latest playlists...`)
      try {
        const baseUrl = 'https://tabrevolver.variabl.co'
        const deviceToken = useAuthStore.getState().deviceToken
        if (!deviceToken) return

        const updatedPlaylists = await window.electronAPI.invoke('fetch-playlists', baseUrl, deviceToken)
        const freshPlaylist = updatedPlaylists.find((p: any) => p.id === selectedPlaylist.id)
        if (freshPlaylist) {
          console.log('[PlayerScreen] Playlist fetched, staging for next loop...')
          pendingPlaylistUpdateRef.current = freshPlaylist
        }
      } catch (err) {
        console.error('[PlayerScreen] Failed to fetch updated playlist:', err)
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
  const [firstTabLoaded, setFirstTabLoaded] = useState(false)
  const [countdown, setCountdown] = useState(10)

  const onReadyCallbackRef = useRef<(() => void) | null>(null)
  const onFailCallbackRef = useRef<(() => void) | null>(null)

  const handleExit = () => {
    document.exitFullscreen().catch(() => { })
    window.electronAPI.invoke('toggle-kiosk', false).catch(() => { })
    window.electronAPI.invoke('stop-player')
    navigate('inactive')

    if (displayId) {
      rtdbUpdate(rtdbRef(rtdb, `screens/${displayId}`), {
        nowPlayingPlaylistId: "",
        updatedAt: Date.now()
      }).catch((err) => {
        console.error('[PlayerScreen] Failed to clear nowPlayingPlaylistId on exit:', err)
      })
    }
  }

  useEffect(() => {
    if (!selectedPlaylist) return

    if (!selectedPlaylist.tabs || selectedPlaylist.tabs.length === 0) {
      setCountdown(0)
      setFirstTabLoaded(true)
      
      // Enter fullscreen and kiosk mode even if empty
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`[PlayerScreen] Error attempting to enable fullscreen: ${err.message}`)
      })
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

    setCountdown(10)
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setFirstTabLoaded(true)

          // Enter fullscreen and kiosk mode when player starts
          document.documentElement.requestFullscreen().catch(err => {
            console.error(`[PlayerScreen] Error attempting to enable fullscreen: ${err.message}`)
          })
          window.electronAPI.invoke('toggle-kiosk', true).catch(err => {
            console.error(`[PlayerScreen] Error attempting to enable kiosk mode: ${err.message}`)
          })

          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [selectedPlaylist?.id])
  useEffect(() => {
    const cleanup = window.electronAPI.on('auth-window-state', (isOpen) => {
      setIsPaused(isOpen as boolean)
    })
    return cleanup
  }, [])

  const setSelectedPlaylist = useAppStore((s) => s.setSelectedPlaylist)



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

        try {
          wv.loadURL(safeUrl)
        } catch (e) {
          console.error('Failed to load URL directly:', e)
        }

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
    const isFixed = selectedPlaylist.rotationType === 'fixed'

    const isYouTube = currentTab.type === 'youtube' || currentTab.faviconURL?.includes('youtube.com')

    const intervalMs = isYouTube
      ? (currentTab.interval || 30) * 1000
      : (isFixed
        ? (selectedPlaylist.defaultInterval || 30) * 1000
        : (currentTab.interval || selectedPlaylist.defaultInterval || 30) * 1000)

    const preloadMs = Math.max(0, intervalMs - 5000)

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
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none">
      <div className="absolute inset-0 h-full w-full">
        {isWebsiteTab(tabA) && (
          <webview
            ref={(el) => {
              webviewARef.current = el;
              if (el) el.setAttribute('allowpopups', '');
            }}
            src={urlA || undefined}
            className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 0 ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
              }`}
          />
        )}

        <div className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 0 && !isWebsiteTab(tabA) ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          {!isWebsiteTab(tabA) && (
            <RendererContainer
              key={renderKeyA}
              tab={tabA}
              isActive={activeView === 0}
              isPaused={isPaused}
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
            ref={(el) => {
              webviewBRef.current = el;
              if (el) el.setAttribute('allowpopups', '');
            }}
            src={urlB || undefined}
            className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 1 ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
              }`}
          />
        )}

        <div className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 1 && !isWebsiteTab(tabB) ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          {!isWebsiteTab(tabB) && (
            <RendererContainer
              key={renderKeyB}
              tab={tabB}
              isActive={activeView === 1}
              isPaused={isPaused}
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
        className={`absolute inset-0 flex flex-col items-center justify-center bg-black z-50 transition-opacity duration-1000 ease-in-out pointer-events-none ${firstTabLoaded ? 'opacity-0' : 'opacity-100'
          }`}
      >
        <GradientWaveText
          className="text-xl font-medium mb-4 h-auto w-auto [--gradient-wave-base:rgb(255,255,255)]"
          customColors={["#DAFA51", "#3b82f6", "#8b5cf6"]}
          speed={1}
          repeat={true}
        >
          Activating display in <span className="text-lg font-mono">
            00:{countdown.toString().padStart(2, '0')}
          </span>
        </GradientWaveText>
        <div className="flex items-center gap-2 text-white/50 text-[clamp(0.8rem,1vw,1rem)] font-light mt-2">
          <Smartphone className="w-[1.2em] h-[1.2em]" />
          <span>To control this screen remotely, visit <span className="text-white/80 font-medium">variabl.co/app</span></span>
        </div>
      </div>

      {firstTabLoaded && (
        <PlayerOverlayScreen
          playlistName={selectedPlaylist?.name || 'My Playlist'}
          tabCount={selectedPlaylist?.tabs?.length || 0}
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
