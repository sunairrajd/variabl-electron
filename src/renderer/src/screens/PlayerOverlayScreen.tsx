import { useEffect, useState, useRef } from 'react'
import { Play, Pause, SkipForward, SkipBack, X, Search, Maximize, Link2, ArrowUp, ArrowDown, ZoomIn, ArrowUpDown } from 'lucide-react'

interface PlayerOverlayScreenProps {
  playlistName: string
  tabCount: number
  currentIndex: number
  currentTabName: string
  isPaused: boolean
  isNavigating: boolean
  onPause: () => void
  onResume: () => void
  onNext: () => void
  onPrev: () => void
  onExit: () => void
  onScroll: (deltaY: number) => void
  onSaveScroll: () => void
  onZoom: (factor: number) => void
  onSaveZoom: () => void
  onFullscreenToggle: () => void
}

export default function PlayerOverlayScreen({
  playlistName,
  tabCount,
  currentIndex,
  currentTabName,
  isPaused,
  isNavigating,
  onPause,
  onResume,
  onNext,
  onPrev,
  onExit,
  onScroll,
  onSaveScroll,
  onZoom,
  onSaveZoom,
  onFullscreenToggle
}: PlayerOverlayScreenProps) {
  const [isVisible, setIsVisible] = useState(false)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const ignoreMouseRef = useRef(0)

  // Use refs for callbacks to avoid re-adding event listeners constantly
  const callbacksRef = useRef({ onPause, onResume })
  useEffect(() => {
    callbacksRef.current = { onPause, onResume }
  }, [onPause, onResume])

  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<'scroll' | 'zoom' | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }

  useEffect(() => {
    document.body.style.cursor = isVisible ? 'default' : 'none'
    return () => {
      document.body.style.cursor = ''
    }
  }, [isVisible])

  useEffect(() => {
    const handleMouseMove = () => {
      if (Date.now() < ignoreMouseRef.current) return

      setIsVisible(true)
      callbacksRef.current.onPause()

      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      
      // If a dropdown is open, don't auto-hide
      if (activeDropdown) return

      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false)
        callbacksRef.current.onResume()
      }, 3000)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [activeDropdown])

  const displayUrl = currentTabName.replace(/^https?:\/\/(www\.)?/, '')

  return (
    <>
      {!isVisible && (
        <div className="absolute inset-0 z-[60]" style={{ cursor: 'none', pointerEvents: 'auto' }} />
      )}
      <div
        className={`absolute inset-0 z-50 pointer-events-none transition-opacity duration-500 ease-in-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 150px 40px rgba(220, 80, 20, 0.7)' }} />
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-black/50 to-transparent" />

        {toastMessage && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 mb-2 px-4 py-2 rounded-full bg-green-500/90 text-white text-sm font-medium shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
            {toastMessage}
          </div>
        )}

        {/* Main Unified Left Panel */}
        <div className="absolute top-8 left-8 w-[420px] pointer-events-auto rounded-[20px] bg-black/20 backdrop-blur-3xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/10 flex flex-col gap-4">
        
        <div className="flex items-start justify-between">
          <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 shadow-sm ${
            isPaused ? 'bg-[#fdf5cc]' : 'bg-green-100'
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${isPaused ? 'bg-[#c2901a]' : 'bg-green-600 animate-pulse'}`} />
            <span className={`text-[9px] font-bold tracking-wide ${isPaused ? 'text-[#9c710d]' : 'text-green-800'}`}>
              {isPaused ? 'Paused' : 'Playing'}
            </span>
          </div>
          
          <button onClick={onExit} className="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-1 pt-0.5">
          <p className="text-[11px] text-white/80 font-medium">Now playing: {displayUrl}</p>
          <h1 className="text-[20px] leading-tight font-bold text-white tracking-tight drop-shadow-sm truncate">
            {playlistName || 'Unknown Playlist'}
          </h1>
          <p className="text-[11px] text-white/80 font-medium">
            {tabCount} tabs . {Math.round((tabCount * 30) / 60)}m duration
          </p>
        </div>

        <div className="flex w-full gap-1 pt-1.5">
          {Array.from({ length: tabCount }).map((_, i) => {
            let segmentClass = 'bg-white/30'
            if (i < currentIndex) segmentClass = 'bg-white/80'
            if (i === currentIndex) segmentClass = 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]'
            
            return (
              <div 
                key={i} 
                className={`h-1.5 flex-1 rounded-full overflow-hidden transition-all duration-500 ease-out ${segmentClass}`} 
              />
            )
          })}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => {
              if (isPaused) {
                callbacksRef.current.onResume()
                setIsVisible(false)
                ignoreMouseRef.current = Date.now() + 1000
              } else {
                callbacksRef.current.onPause()
              }
            }}
            className={`flex items-center justify-center gap-2 h-10 px-4 rounded-xl shadow-md transition-transform hover:scale-105 active:scale-95 ${
              isPaused ? 'bg-[#0F9D58] hover:bg-[#0d864b] text-white' : 'bg-[#0F9D58] hover:bg-[#0d864b] text-white'
            }`}
          >
            {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
            <span className="text-[13px] font-semibold">{isPaused ? 'Resume playing' : 'Pause'}</span>
          </button>
          
          <button 
            onClick={onPrev} 
            disabled={isNavigating}
            className={`flex items-center justify-center h-10 w-[48px] rounded-xl bg-white text-slate-800 shadow-md transition-transform ${isNavigating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 hover:scale-105 active:scale-95'}`}
          >
            <SkipBack className="h-4 w-4 fill-current" />
          </button>

          <button 
            onClick={onNext} 
            disabled={isNavigating}
            className={`flex items-center justify-center h-10 w-[48px] rounded-xl bg-white text-slate-800 shadow-md transition-transform ${isNavigating ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 hover:scale-105 active:scale-95'}`}
          >
            <SkipForward className="h-4 w-4 fill-current" />
          </button>

          <button onClick={onExit} className="flex flex-1 items-center justify-center h-10 px-3 rounded-xl bg-white hover:bg-gray-100 text-slate-800 text-[13px] font-semibold shadow-md transition-transform hover:scale-105 active:scale-95">
            View all playlists
          </button>
        </div>
      </div>

      {/* Top Right Panel for Settings */}
      <div className="absolute top-10 right-10 pointer-events-auto flex gap-3 rounded-[32px] bg-black/20 backdrop-blur-3xl p-3.5 shadow-2xl border border-white/10">
        
        {/* Scroll Dropdown Container */}
        <div className="relative flex">
          <button
            onClick={() => setActiveDropdown(activeDropdown === 'scroll' ? null : 'scroll')}
            title="Scroll Position"
            className={`flex h-14 w-[72px] items-center justify-center rounded-[20px] shadow-sm transition hover:scale-105 active:scale-95 ${activeDropdown === 'scroll' ? 'bg-gray-200' : 'bg-white hover:bg-gray-50'}`}
          >
            <ArrowUpDown className="h-6 w-6 text-black" strokeWidth={2.5} />
          </button>
          
          {activeDropdown === 'scroll' && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 flex flex-col gap-2 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 p-3 shadow-xl items-center">
              <div className="flex gap-2">
                <button 
                  onClick={() => onScroll(-200)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/95 hover:bg-white text-black shadow-md transition hover:scale-105 active:scale-95"
                  title="Scroll Up"
                >
                  <ArrowUp className="h-6 w-6" strokeWidth={2.5} />
                </button>
                <button 
                  onClick={() => onScroll(200)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/95 hover:bg-white text-black shadow-md transition hover:scale-105 active:scale-95"
                  title="Scroll Down"
                >
                  <ArrowDown className="h-6 w-6" strokeWidth={2.5} />
                </button>
              </div>
              <button 
                onClick={() => {
                  onSaveScroll()
                  setActiveDropdown(null)
                  showToast("Scroll position saved!")
                }}
                className="w-full mt-1 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-black text-white text-xs font-bold transition shadow-md"
              >
                Save Position
              </button>
            </div>
          )}
        </div>

        {/* Zoom Dropdown Container */}
        <div className="relative flex">
          <button
            onClick={() => setActiveDropdown(activeDropdown === 'zoom' ? null : 'zoom')}
            title="Zoom Level"
            className={`flex h-14 w-[72px] items-center justify-center rounded-[20px] shadow-sm transition hover:scale-105 active:scale-95 ${activeDropdown === 'zoom' ? 'bg-gray-200' : 'bg-white hover:bg-gray-50'}`}
          >
            <ZoomIn className="h-6 w-6 text-black" strokeWidth={2.5} />
          </button>

          {activeDropdown === 'zoom' && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 flex flex-col gap-1.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 p-2.5 shadow-xl w-32">
              {[50, 75, 100, 125, 150, 200].map((level) => (
                <button
                  key={level}
                  onClick={() => onZoom(level / 100)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20 active:scale-95"
                >
                  <span>{level}%</span>
                </button>
              ))}
              <button 
                onClick={() => {
                  onSaveZoom()
                  setActiveDropdown(null)
                  showToast("Zoom level saved!")
                }}
                className="w-full mt-1 py-2 rounded-lg bg-[#2a2a2a] hover:bg-black text-white text-xs font-bold transition shadow-md"
              >
                Save Zoom
              </button>
            </div>
          )}
        </div>

        {/* Fullscreen Button */}
        <button
          onClick={() => {
            setActiveDropdown(null)
            onFullscreenToggle()
          }}
          title="Fullscreen"
          className="flex h-14 w-[72px] items-center justify-center rounded-[20px] bg-white shadow-sm transition hover:bg-gray-50 hover:scale-105 active:scale-95"
        >
          <Maximize className="h-6 w-6 text-black" strokeWidth={2.5} />
        </button>

      </div>
    </div>
    </>
  )
}
