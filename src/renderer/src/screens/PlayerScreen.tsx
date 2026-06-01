import { useEffect, useRef, useState } from 'react'
import { useAppStore, PlaylistTab } from '@/stores/useAppStore'
import { Loader2 } from 'lucide-react'
import PlayerOverlayScreen from './PlayerOverlayScreen'
import { SyncService } from '@/services/SyncService'
import RendererContainer from '@/components/renderers/RendererContainer'

const isWebsiteTab = (tab: PlaylistTab | null) => {
  if (!tab) return true;
  return !['youtube', 'image', 'message', 'announcement', 'gsheet'].includes(tab.type) && !tab.faviconURL?.includes('youtube.com');
}

export default function PlayerScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const selectedPlaylist = useAppStore((s) => s.selectedPlaylist)
  const webviewARef = useRef<any>(null)
  const webviewBRef = useRef<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

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

  const onReadyCallbackRef = useRef<(() => void) | null>(null)
  const onFailCallbackRef = useRef<(() => void) | null>(null)

  const handleExit = () => {
    window.electronAPI.invoke('stop-player')
    navigate('picker')
  }

  useEffect(() => {
    if (selectedPlaylist?.tabs?.[0]) {
      const initialTab = selectedPlaylist.tabs[0]
      setTabA(initialTab)
      setRenderKeyA(Date.now())
      
      if (isWebsiteTab(initialTab)) {
        const initialUrl = initialTab.url.startsWith('http')
          ? initialTab.url
          : `https://${initialTab.url}`
        setUrlA(initialUrl)

        // Fallback to ensure loader fades out within 3 seconds
        const timer = setTimeout(() => {
          setFirstTabLoaded(true)
        }, 3000)
        return () => clearTimeout(timer)
      }
    }
    return undefined
  }, [selectedPlaylist])

  useEffect(() => {
    const wv = webviewARef.current
    if (!wv) return

    const handleLoad = () => {
      setFirstTabLoaded(true)
    }

    wv.addEventListener('did-finish-load', handleLoad)
    wv.addEventListener('did-fail-load', handleLoad)

    return () => {
      wv.removeEventListener('did-finish-load', handleLoad)
      wv.removeEventListener('did-fail-load', handleLoad)
    }
  }, [urlA])

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
        setSelectedPlaylist({ ...selectedPlaylist, tabs: updatedTabs })
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
        setSelectedPlaylist({ ...selectedPlaylist, tabs: updatedTabs })
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
    if (!selectedPlaylist?.tabs) return
    if (isRotating && !force) return // Prevent overlapping rotations unless forced (manual skip)

    setIsRotating(true)

    const nextTab = selectedPlaylist.tabs[nextIndex]
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

        if (nextView === 0) setUrlA(safeUrl)
        else setUrlB(safeUrl)

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
          const skipIndex = (nextIndex + 1) % selectedPlaylist.tabs.length
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
    if (isPaused || isRotating) return

    const currentTab = selectedPlaylist.tabs[currentIndex]
    const isFixed = selectedPlaylist.rotationType === 'fixed'
    
    const isYouTube = currentTab.type === 'youtube' || currentTab.faviconURL?.includes('youtube.com')

    const intervalMs = isYouTube
      ? (currentTab.interval || 30) * 1000
      : (isFixed
        ? (selectedPlaylist.defaultInterval || 30) * 1000
        : (currentTab.interval || selectedPlaylist.defaultInterval || 30) * 1000)

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      const nextIndex = (currentIndex + 1) % selectedPlaylist.tabs.length
      triggerRotation(nextIndex)
    }, intervalMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentIndex, isPaused, activeView, selectedPlaylist, isRotating])

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

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      <webview
        ref={webviewARef}
        src={urlA || undefined}
        className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 0 && isWebsiteTab(tabA) ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
          }`}
      />
      
      <div className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 0 && !isWebsiteTab(tabA) ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
        {!isWebsiteTab(tabA) && (
          <RendererContainer 
            key={renderKeyA}
            tab={tabA} 
            isActive={activeView === 0}
            isPaused={isPaused}
            onFinish={handleNext} 
            onReady={() => {
              setFirstTabLoaded(true)
              if (activeView !== 0) onReadyCallbackRef.current?.()
            }} 
            onFail={() => {
              setFirstTabLoaded(true)
              if (activeView !== 0) onFailCallbackRef.current?.()
            }} 
          />
        )}
      </div>

      <webview
        ref={webviewBRef}
        src={urlB || undefined}
        className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 1 && isWebsiteTab(tabB) ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
          }`}
      />

      <div className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 1 && !isWebsiteTab(tabB) ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
        {!isWebsiteTab(tabB) && (
          <RendererContainer 
            key={renderKeyB}
            tab={tabB} 
            isActive={activeView === 1}
            isPaused={isPaused}
            onFinish={handleNext} 
            onReady={() => {
              setFirstTabLoaded(true)
              if (activeView !== 1) onReadyCallbackRef.current?.()
            }} 
            onFail={() => {
              setFirstTabLoaded(true)
              if (activeView !== 1) onFailCallbackRef.current?.()
            }} 
          />
        )}
      </div>

      {/* "Your screen is ready" beautiful preloader overlay */}
      <div 
        className={`absolute inset-0 flex flex-col items-center justify-center bg-black z-50 transition-opacity duration-1000 ease-in-out pointer-events-none ${
          firstTabLoaded ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <h1 className="text-2xl font-medium bg-gradient-to-r from-[#84cc16] via-[#3b82f6] to-[#8b5cf6] bg-clip-text text-transparent animate-pulse mb-4">
          Your screen is ready
        </h1>
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>

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
      />
    </div>
  )
}
