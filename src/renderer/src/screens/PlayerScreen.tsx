import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { Loader2 } from 'lucide-react'
import PlayerOverlayScreen from './PlayerOverlayScreen'

export default function PlayerScreen() {
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

  const handleNext = () => {
    if (!selectedPlaylist?.tabs) return
    const nextIndex = (currentIndex + 1) % selectedPlaylist.tabs.length
    triggerRotation(nextIndex)
  }

  const handlePrev = () => {
    if (!selectedPlaylist?.tabs) return
    const prevIndex = (currentIndex - 1 + selectedPlaylist.tabs.length) % selectedPlaylist.tabs.length
    triggerRotation(prevIndex)
  }

  const triggerRotation = (nextIndex: number) => {
    if (!selectedPlaylist?.tabs) return
    const nextTab = selectedPlaylist.tabs[nextIndex]
    const safeUrl = nextTab.url.startsWith('http') ? nextTab.url : `https://${nextTab.url}`

    const nextView = activeView === 0 ? 1 : 0
    const wv = nextView === 0 ? webviewARef.current : webviewBRef.current
    
    if (wv) {
      const onFinishLoad = () => {
        setActiveView(nextView)
        setCurrentIndex(nextIndex)
        wv.removeEventListener('did-finish-load', onFinishLoad)
      }
      wv.addEventListener('did-finish-load', onFinishLoad)
      
      setTimeout(() => {
        wv.removeEventListener('did-finish-load', onFinishLoad)
        setActiveView(nextView)
        setCurrentIndex(nextIndex)
      }, 5000)

      if (nextView === 0) setUrlA(safeUrl)
      else setUrlB(safeUrl)
    } else {
      setActiveView(nextView)
      setCurrentIndex(nextIndex)
      if (nextView === 0) setUrlA(safeUrl)
      else setUrlB(safeUrl)
    }
  }

  useEffect(() => {
    if (!selectedPlaylist?.tabs || selectedPlaylist.tabs.length === 0) return
    if (isPaused) return

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
  }, [currentIndex, isPaused, activeView, selectedPlaylist])

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden">
      <webview
        ref={webviewARef}
        src={urlA || undefined}
        className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${
          activeView === 0 ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
        }`}
      />
      <webview
        ref={webviewBRef}
        src={urlB || undefined}
        className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ease-in-out ${
          activeView === 1 ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
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
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onNext={handleNext}
        onPrev={handlePrev}
        onExit={handleExit}
      />
    </div>
  )
}
