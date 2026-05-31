import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Loader2 } from 'lucide-react'
import PlayerOverlayScreen from './PlayerOverlayScreen'
import { SyncService } from '@/services/SyncService'

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
  const [isPaused, setIsPaused] = useState(false)

  const handleExit = () => {
    window.electronAPI.invoke('stop-player')
    navigate('picker')
  }

  useEffect(() => {
    if (selectedPlaylist?.tabs?.[0]) {
      const initialUrl = selectedPlaylist.tabs[0].url.startsWith('http')
        ? selectedPlaylist.tabs[0].url
        : `https://${selectedPlaylist.tabs[0].url}`
      setUrlA(initialUrl)
    }
  }, [selectedPlaylist])

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
    const safeUrl = nextTab.url.startsWith('http') ? nextTab.url : `https://${nextTab.url}`

    const nextView = activeView === 0 ? 1 : 0
    const wv = nextView === 0 ? webviewARef.current : webviewBRef.current

    // Clear the auto-rotation timer immediately
    if (timerRef.current) clearTimeout(timerRef.current)

    // Clear any pending fallback timeout from a previous forced rotation
    if (rotationTimeoutRef.current) {
      clearTimeout(rotationTimeoutRef.current)
      rotationTimeoutRef.current = null
    }

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
        wv.removeEventListener('did-fail-load', onFinishLoad)

        applyTabSettings()
        // Wait just a tiny bit for the paint to catch up before swapping opacity
        setTimeout(() => {
          setActiveView(nextView)
          setCurrentIndex(nextIndex)
          setIsRotating(false)
        }, 100)
      }

      wv.addEventListener('did-finish-load', onFinishLoad)
      wv.addEventListener('did-fail-load', onFinishLoad) // If it fails (e.g. adblock or ERR_FAILED), skip crossfade hang

      // Fallback timeout in case load takes too long
      rotationTimeoutRef.current = setTimeout(() => {
        wv.removeEventListener('did-finish-load', onFinishLoad)
        wv.removeEventListener('did-fail-load', onFinishLoad)

        applyTabSettings()
        setActiveView(nextView)
        setCurrentIndex(nextIndex)
        setIsRotating(false)
      }, 3000)

      if (nextView === 0) setUrlA(safeUrl)
      else setUrlB(safeUrl)

      // Force navigation in case the URL string is identical but we need a reload
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
  }

  useEffect(() => {
    if (!selectedPlaylist?.tabs || selectedPlaylist.tabs.length === 0) return
    if (isPaused || isRotating) return

    const currentTab = selectedPlaylist.tabs[currentIndex]
    const isFixed = selectedPlaylist.rotationType === 'fixed'
    const intervalSecs = isFixed
      ? (selectedPlaylist.defaultInterval || 30)
      : (currentTab.interval || selectedPlaylist.defaultInterval || 30)

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      const nextIndex = (currentIndex + 1) % selectedPlaylist.tabs.length
      triggerRotation(nextIndex)
    }, intervalSecs * 1000)

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
        className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 0 ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
          }`}
      />
      <webview
        ref={webviewBRef}
        src={urlB || undefined}
        className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${activeView === 1 ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
          }`}
      />

      {(!urlA && !urlB) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-20 pointer-events-none">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      )}

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
