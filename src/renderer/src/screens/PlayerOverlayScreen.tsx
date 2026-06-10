import { useEffect, useState, useRef } from 'react'
import { Play, Pause, SkipForward, SkipBack, X, Search, Maximize, Link2, ArrowUp, ArrowDown, ZoomIn, ArrowUpDown } from 'lucide-react'
import scrollIcon from '@/assets/scroll.svg'
import { PlaylistTab } from '@/stores/useAppStore'

import browserIcon from '@/assets/apps/browser.svg'
import grafanaIcon from '@/assets/apps/grafana.svg'
import imageIcon from '@/assets/apps/image.svg'
import lookerIcon from '@/assets/apps/looker.svg'
import messageIcon from '@/assets/apps/message.svg'
import sheetsIcon from '@/assets/apps/sheets.svg'
import youtubeIcon from '@/assets/apps/youtube.svg'

const getTabIcon = (tab: PlaylistTab) => {
  if (!tab) return browserIcon

  const type = tab.type?.toLowerCase()
  const url = tab.url?.toLowerCase() || ''

  if (type === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
    return youtubeIcon
  }
  if (type === 'image') {
    return imageIcon
  }
  if (type === 'message' || type === 'announcement') {
    return messageIcon
  }
  if (type === 'gsheet' || url.includes('docs.google.com/spreadsheets')) {
    return sheetsIcon
  }
  if (url.includes('looker') || url.includes('lookerstudio.google.com')) {
    return lookerIcon
  }
  if (url.includes('grafana')) {
    return grafanaIcon
  }

  return browserIcon
}

const getTabBgColor = (tab: PlaylistTab) => {
  if (!tab) return '#FFFDF5'

  const type = tab.type?.toLowerCase()
  const url = tab.url?.toLowerCase() || ''

  if (type === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
    return '#FFF2EE'
  }
  if (type === 'image') {
    return '#EEF7FF'
  }
  if (type === 'message' || type === 'announcement') {
    return '#EEFFFF'
  }
  if (type === 'gsheet' || url.includes('docs.google.com/spreadsheets')) {
    return '#EEFFF4'
  }
  if (url.includes('looker') || url.includes('lookerstudio.google.com')) {
    return '#FFFBEE'
  }
  if (url.includes('grafana')) {
    return '#FFFAEE'
  }

  return '#FFFDF5'
}

interface PlayerOverlayScreenProps {
  playlistName: string
  tabs: PlaylistTab[]
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
  canScroll: boolean
  canZoom: boolean
  durationSeconds: number
}

export default function PlayerOverlayScreen({
  playlistName,
  tabs,
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
  onFullscreenToggle,
  canScroll,
  canZoom,
  durationSeconds
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
        className={`absolute top-[-1px] bottom-[-1px] left-[-1px] right-[-1px] z-50 pointer-events-none transition-opacity duration-500 ease-in-out border-[6px] border-[#E20029] ${isVisible ? 'opacity-100' : 'opacity-0'
          }`}
      >
        {/* Grey shadow top and bottom */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/35 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/45 to-transparent pointer-events-none" />

        {toastMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 mb-2 px-4 py-2 rounded-full bg-green-500/90 text-white text-sm font-medium shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
            {toastMessage}
          </div>
        )}

        {/* Top Center Controls (Red) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#E20029] text-white px-4 py-2 rounded-b-2xl flex items-center gap-4 pointer-events-auto shadow-lg">
          {/* Left Inverse Curve */}
          <svg className="absolute top-0 -left-4 w-4 h-4 pointer-events-none" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0V16C16 7.16344 8.83656 0 0 0H16Z" fill="#E20029" />
          </svg>
          {/* Right Inverse Curve */}
          <svg className="absolute top-0 -right-4 w-4 h-4 pointer-events-none" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0V16C0 7.16344 7.16344 0 16 0H0Z" fill="#E20029" />
          </svg>

          <div className="flex items-center gap-2">
            <span className="text-sm font-normal">{isPaused ? 'Paused' : 'Playing'}</span>
          </div>

          <div className="w-px h-5 bg-white/30" />

          <div className="flex items-center gap-2">
            <button onClick={onPrev} disabled={isNavigating} className="p-1.5 hover:bg-white/20 rounded-md transition disabled:opacity-50">
              <SkipBack className="h-4 w-4 fill-current" />
            </button>
            <button
              onClick={() => {
                if (isPaused) {
                  callbacksRef.current.onResume()

                  if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
                  hideTimeoutRef.current = setTimeout(() => {
                    setIsVisible(false)
                  }, 3000)

                  ignoreMouseRef.current = Date.now() + 3000
                } else {
                  callbacksRef.current.onPause()
                }
              }}
              className="flex items-center justify-center gap-1.5 bg-[#019131] hover:bg-[#0b8046] text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors w-[160px]"
            >
              {isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
              <span>{isPaused ? 'Resume playing' : 'Pause'}</span>
            </button>
            <button onClick={onNext} disabled={isNavigating} className="p-1.5 hover:bg-white/20 rounded-md transition disabled:opacity-50">
              <SkipForward className="h-4 w-4 fill-current" />
            </button>
          </div>
        </div>

        {/* Top Right Close Button */}
        <button onClick={onExit} className="absolute top-2 right-4 pointer-events-auto text-white hover:bg-white/20 p-2 rounded-full transition-colors z-50">
          <X className="h-7 w-7" strokeWidth={2.5} />
        </button>

        {/* Right Side Options (Centrally aligned) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-auto flex flex-col gap-3 rounded-2xl bg-black/20 backdrop-blur-md p-2.5 shadow-2xl border border-white/10">

          {/* Scroll */}
          <div className="relative flex">
            <button
              onClick={() => canScroll && setActiveDropdown(activeDropdown === 'scroll' ? null : 'scroll')}
              title="Scroll Position"
              disabled={!canScroll}
              className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition ${!canScroll
                ? 'opacity-40 cursor-not-allowed bg-white/50'
                : activeDropdown === 'scroll'
                  ? 'bg-gray-200 scale-105'
                  : 'bg-white hover:bg-gray-50 hover:scale-105 active:scale-95'
                }`}
            >
              <img src={scrollIcon} className="h-5 w-5" alt="Scroll" />
            </button>

            {activeDropdown === 'scroll' && canScroll && (
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-4 flex flex-col gap-2 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 p-3 shadow-xl items-center w-32">
                <div className="flex gap-2">
                  <button
                    onClick={() => onScroll(-200)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 hover:bg-white text-black shadow-md transition hover:scale-105 active:scale-95"
                  >
                    <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                  <button
                    onClick={() => onScroll(200)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 hover:bg-white text-black shadow-md transition hover:scale-105 active:scale-95"
                  >
                    <ArrowDown className="h-5 w-5" strokeWidth={2.5} />
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

          {/* Zoom */}
          <div className="relative flex">
            <button
              onClick={() => canZoom && setActiveDropdown(activeDropdown === 'zoom' ? null : 'zoom')}
              title="Zoom Level"
              disabled={!canZoom}
              className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition ${!canZoom
                ? 'opacity-40 cursor-not-allowed bg-white/50'
                : activeDropdown === 'zoom'
                  ? 'bg-gray-200 scale-105'
                  : 'bg-white hover:bg-gray-50 hover:scale-105 active:scale-95'
                }`}
            >
              <ZoomIn className="h-5 w-5 text-black" strokeWidth={2.5} />
            </button>

            {activeDropdown === 'zoom' && canZoom && (
              <div className="absolute right-full top-1/2 -translate-y-1/2 mr-4 flex flex-col gap-1.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 p-2.5 shadow-xl w-32">
                {[25, 50, 75, 100, 125, 150, 200].map((level) => (
                  <button
                    key={level}
                    onClick={() => onZoom(level / 100)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20 active:scale-95"
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
                  className="w-full mt-1 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-black text-white text-xs font-bold transition shadow-md"
                >
                  Save Zoom
                </button>
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button
            onClick={() => {
              setActiveDropdown(null)
              onFullscreenToggle()
            }}
            title="Fullscreen"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm transition hover:bg-gray-50 hover:scale-105 active:scale-95"
          >
            <Maximize className="h-5 w-5 text-black" strokeWidth={2.5} />
          </button>
        </div>

        {/* Bottom Center Tabs */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-[80%] min-w-[400px] pointer-events-auto flex flex-col gap-3 rounded-[24px] bg-black/20 backdrop-blur-lg p-4 shadow-2xl border border-white/10">
          <div className="flex justify-between items-center text-[clamp(12px,0.6vw,16px)] text-white font-medium px-2 gap-8 ">
            <span className="truncate flex-1 font-medium">{playlistName || 'Unknown Playlist'}</span>
            <span className="whitespace-nowrap font-medium text-white">
              {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'} • {(() => {
                const mins = Math.floor(durationSeconds / 60)
                const secs = durationSeconds % 60
                if (mins === 0) return `${secs}s`
                if (secs === 0) return `${mins}m`
                return `${mins}m ${secs}s`
              })()} duration
            </span>
          </div>

          <div className="w-full max-h-[25vh] overflow-y-auto py-3 pt-3 pb-0 [&::-webkit-scrollbar]:hidden">
            <div className="flex flex-wrap justify-center gap-[0.5vw] mx-auto py-2 px-1">
              {tabs.map((tab, i) => {
                const isActive = i === currentIndex;
                const isPast = i < currentIndex;
                const icon = getTabIcon(tab)
                const bgColor = getTabBgColor(tab)
                return (
                  <div
                    key={i}
                    style={{ backgroundColor: bgColor }}
                    className={`my-1  flex-shrink-0 h-[clamp(2.25rem,2.5vw,4.25rem)] w-[clamp(2.25rem,2.5vw,4.25rem)] flex items-center justify-center rounded-[30%] transition-all duration-300 ${isActive
                      ? 'opacity-100 shadow-[0_0_0.8vw_rgba(0,0,0,0.5)] ring-[0.15vw] ring-[#66B10B] scale-110 z-10'
                      : isPast
                        ? 'opacity-90 hover:opacity-100'
                        : 'opacity-70 hover:opacity-90'
                      }`}
                  >
                    <div className="relative h-1/2 w-1/2 flex items-center justify-center">
                      <img src={icon} className="h-full w-full object-contain" alt={tab.type || 'tab'} />
                      {icon === browserIcon && (tab.faviconURL || tab.url) && (() => {
                        const faviconSrc = tab.faviconURL || (tab.url ? `https://www.google.com/s2/favicons?domain=${new URL(tab.url.startsWith('http') ? tab.url : `https://${tab.url}`).hostname}&sz=64` : '');
                        return faviconSrc ? (
                          <div className="absolute -bottom-[20%] -right-[20%] w-[90%] h-[90%] bg-white rounded-full flex items-center justify-center shadow-xs ">
                            <img
                              src={faviconSrc}
                              className="w-[90%] h-[90%] rounded-full object-contain"
                              alt="favicon"
                              onError={(e) => {
                                (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
