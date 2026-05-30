import { useEffect, useState, useRef } from 'react'
import { Play, Pause, SkipForward, SkipBack, X, Search, Maximize, Link2 } from 'lucide-react'

interface PlayerOverlayScreenProps {
  playlistName: string
  tabCount: number
  currentIndex: number
  currentTabName: string
  isPaused: boolean
  onPause: () => void
  onResume: () => void
  onNext: () => void
  onPrev: () => void
  onExit: () => void
}

export default function PlayerOverlayScreen({
  playlistName,
  tabCount,
  currentIndex,
  currentTabName,
  isPaused,
  onPause,
  onResume,
  onNext,
  onPrev,
  onExit
}: PlayerOverlayScreenProps) {
  const [isVisible, setIsVisible] = useState(true)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    document.body.style.cursor = isVisible ? 'default' : 'none'
    return () => {
      document.body.style.cursor = ''
    }
  }, [isVisible])

  useEffect(() => {
    const handleMouseMove = () => {
      setIsVisible(true)

      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      
      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false)
      }, 5000)
    }

    handleMouseMove()

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  const displayUrl = currentTabName.replace(/^https?:\/\/(www\.)?/, '')

  return (
    <div
      className={`absolute inset-0 z-50 pointer-events-none transition-opacity duration-500 ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-black/50 to-transparent" />

      {/* Top Left Panel */}
      <div className="absolute top-6 left-6 w-[480px] pointer-events-auto rounded-[24px] bg-black/40 backdrop-blur-2xl p-5 shadow-2xl border border-white/10 flex flex-col gap-4">
        
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 shadow-sm ${
            isPaused ? 'bg-[#fdf4d2]' : 'bg-green-100'
          }`}>
            <div className={`h-2 w-2 rounded-full ${isPaused ? 'bg-[#c2901a]' : 'bg-green-600 animate-pulse'}`} />
            <span className={`text-[10px] font-bold tracking-wide ${isPaused ? 'text-[#9c710d]' : 'text-green-800'}`}>
              {isPaused ? 'Paused' : 'Playing'}
            </span>
          </div>
          
          <button onClick={onExit} className="text-white/70 hover:text-white transition-colors p-1">
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-white/80 font-medium">Now playing: {displayUrl}</p>
          <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm truncate">
            {playlistName || 'Unknown Playlist'}
          </h1>
          <p className="text-xs text-white/80 font-medium">
            {tabCount} tabs . {tabCount * 30}s duration
          </p>
        </div>

        <div className="flex w-full gap-1.5 pt-1">
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

        <div className="flex items-center gap-2.5 pt-2">
          <button
            onClick={() => {
              if (isPaused) {
                onResume()
                setIsVisible(false)
              } else {
                onPause()
              }
            }}
            className={`flex items-center justify-center gap-2 h-10 w-40 rounded-xl shadow-md transition-transform hover:scale-105 active:scale-95 ${
              isPaused ? 'bg-[#0F9D58] hover:bg-[#0d864b] text-white' : 'bg-white hover:bg-gray-100 text-slate-800'
            }`}
          >
            {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
            <span className="text-sm font-bold">{isPaused ? 'Resume playing' : 'Pause'}</span>
          </button>
          
          <button onClick={onPrev} className="flex items-center justify-center h-10 w-12 rounded-xl bg-white hover:bg-gray-100 text-slate-700 shadow-md transition-transform hover:scale-105 active:scale-95">
            <SkipBack className="h-4 w-4 fill-current" />
          </button>
          
          <button onClick={onNext} className="flex items-center justify-center h-10 w-12 rounded-xl bg-white hover:bg-gray-100 text-slate-700 shadow-md transition-transform hover:scale-105 active:scale-95">
            <SkipForward className="h-4 w-4 fill-current" />
          </button>
          
          <button onClick={onExit} className="flex flex-1 items-center justify-center h-10 rounded-xl bg-white hover:bg-gray-100 text-slate-800 text-sm font-bold shadow-md transition-transform hover:scale-105 active:scale-95">
            View all playlists
          </button>
        </div>
      </div>

      {/* Top Right Panel */}
      <div className="absolute top-6 right-6 pointer-events-auto flex items-center gap-2 rounded-[20px] bg-black/40 backdrop-blur-2xl p-2.5 shadow-2xl border border-white/10">
        {[
          { icon: <Search className="h-4 w-4 text-slate-700" strokeWidth={2.5} />, label: 'Search' },
          { icon: <Link2 className="h-4 w-4 text-slate-700" strokeWidth={2.5} />, label: 'Copy Link' },
          { icon: <Maximize className="h-4 w-4 text-slate-700" strokeWidth={2.5} />, label: 'Fullscreen' }
        ].map((btn, i) => (
          <button
            key={i}
            title={btn.label}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm transition hover:bg-gray-100 hover:scale-105 active:scale-95"
          >
            {btn.icon}
          </button>
        ))}
      </div>

    </div>
  )
}
