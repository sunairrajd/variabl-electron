import { PlaylistTab } from '@/stores/useAppStore'
import { useEffect, useState, useRef } from 'react'

// Do not export this function to avoid Vite Fast Refresh crashes
function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

interface Props {
  tab: PlaylistTab
  isActive: boolean
  isPaused?: boolean
  onFinish?: () => void
  onReady: () => void
  onFail: () => void
}

export default function YouTubeRenderer({ tab, isActive, isPaused, onFinish, onReady, onFail }: Props) {
  const videoId = extractYouTubeId(tab.url)
  const [hasBeenActive, setHasBeenActive] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const readyFiredRef = useRef(false)

  const onReadyRef = useRef(onReady)
  const onFailRef = useRef(onFail)
  const onFinishRef = useRef(onFinish)

  useEffect(() => {
    onReadyRef.current = onReady
    onFailRef.current = onFail
    onFinishRef.current = onFinish
  }, [onReady, onFail, onFinish])

  useEffect(() => {
    if (isActive) setHasBeenActive(true)
  }, [isActive])

  const isPausedRef = useRef(isPaused)
  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  // CRITICAL: We MUST construct the iframe URL manually. 
  // If we use window.YT.Player, it automatically injects localhost as the origin,
  // which clashes with our https://variabl.co header spoofing and causes a 403 Forbidden!
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=0&mute=${tab.mute ? '1' : '0'}&controls=0&rel=0&modestbranding=1&fs=0&iv_load_policy=3&playsinline=1&enablejsapi=1&origin=https://variabl.co`
    : null

  const handleLoad = () => {
    if (!readyFiredRef.current) {
      readyFiredRef.current = true
      setTimeout(() => onReadyRef.current(), 500)
    }
  }

  const handleError = () => {
    if (!readyFiredRef.current) {
      readyFiredRef.current = true
      onFailRef.current()
    }
  }

  // Fallback timeout in case iframe onload never fires
  useEffect(() => {
    readyFiredRef.current = false
    const timeout = setTimeout(() => {
      if (!readyFiredRef.current) {
        readyFiredRef.current = true
        onReadyRef.current()
      }
    }, 5000)
    return () => clearTimeout(timeout)
  }, [embedUrl])

  // Handle Play/Pause via postMessage
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow || !isActive) return

    try {
      if (isPaused) {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          '*'
        )
      } else {
        iframe.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
          '*'
        )
      }
    } catch {
      // ignore
    }
  }, [isPaused, isActive])

  // Listen for YouTube player state changes to detect video end
  useEffect(() => {
    if (!isActive) return

    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes('youtube.com')) return

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        if (data?.event === 'onReady' || data?.event === 'initialDelivery') {
          const iframe = iframeRef.current
          if (iframe?.contentWindow && isActive && !isPausedRef.current) {
            iframe.contentWindow.postMessage(
              JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
              '*'
            )
          }
        } else if (data?.event === 'onStateChange' && data?.info === 0) {
          onFinishRef.current?.()
        }
      } catch {
        // ignore
      }
    }

    window.addEventListener('message', handleMessage)

    // Tell the iframe to start sending events
    const iframe = iframeRef.current
    if (iframe?.contentWindow) {
      setTimeout(() => {
        try {
          iframe.contentWindow!.postMessage(
            JSON.stringify({ event: 'listening', id: 1 }),
            '*'
          )
        } catch {}
      }, 1000)
    }

    return () => window.removeEventListener('message', handleMessage)
  }, [isActive])

  if (!videoId || !embedUrl) return null

  // pointer-events-auto allows the video to be interacted with when active if needed
  return (
    <div className="w-full h-full bg-black relative">
      <div className={`absolute inset-0 w-full h-full transition-opacity duration-500 ${isActive || hasBeenActive ? 'opacity-100' : 'opacity-0'} ${isActive ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <iframe
          ref={iframeRef}
          src={embedUrl}
          onLoad={handleLoad}
          onError={handleError}
          allow="autoplay; encrypted-media; fullscreen"
          className="w-full h-full border-none"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}
