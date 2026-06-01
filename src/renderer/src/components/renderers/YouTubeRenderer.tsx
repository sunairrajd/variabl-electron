import { PlaylistTab } from '@/stores/useAppStore'
import { useEffect, useState, useRef } from 'react'

export function extractYouTubeId(url: string): string | null {
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

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

export default function YouTubeRenderer({ tab, isActive, isPaused, onFinish, onReady, onFail }: Props) {
  const videoId = extractYouTubeId(tab.url)
  const [hasBeenActive, setHasBeenActive] = useState(false)
  const [apiReady, setApiReady] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const playerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
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

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
      } else {
        document.head.appendChild(tag)
      }
      
      const prevCallback = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback()
        setApiReady(true)
      }
    } else {
      setApiReady(true)
    }
  }, [])

  // Initialize Player
  useEffect(() => {
    if (!apiReady || !videoId || !containerRef.current || playerRef.current) return

    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId,
      playerVars: {
        autoplay: 0, // Disable background autoplay to prevent Chromium restrictions
        controls: 0,
        rel: 0,
        modestbranding: 1,
        fs: 0,
        iv_load_policy: 3,
        mute: tab.mute ? 1 : 0
      },
      events: {
        onReady: (event: any) => {
          try {
            event.target.setPlaybackQuality('highres')
          } catch (e) {}
          setPlayerReady(true)
          
          setTimeout(() => {
            onReadyRef.current()
          }, 500)
        },
        onError: () => {
          onFailRef.current()
        },
        onStateChange: (event: any) => {
          try {
            event.target.setPlaybackQuality('highres')
          } catch (e) {}
        }
      }
    })

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
        setPlayerReady(false)
      }
    }
  }, [apiReady, videoId, tab.mute])

  // Handle Play/Pause based on isPaused prop
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
      if (isPaused) {
        playerRef.current.pauseVideo()
      } else if (isActive) {
        playerRef.current.playVideo()
      }
    }
  }, [isPaused, isActive, playerReady])

  // Poll for video end (T-1 second)
  useEffect(() => {
    if (!isActive) return
    
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const currentTime = playerRef.current.getCurrentTime()
        const duration = playerRef.current.getDuration()
        
        if (duration > 0 && currentTime >= duration - 1) {
          if (onFinishRef.current) {
            onFinishRef.current()
            clearInterval(interval)
          }
        }
      }
    }, 250)

    return () => clearInterval(interval)
  }, [isActive])

  if (!videoId) return null

  return (
    <div className="w-full h-full bg-black relative">
      <div className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-500 ${isActive || hasBeenActive ? 'opacity-100' : 'opacity-0'}`}>
        <div ref={containerRef} className="w-full h-full border-none" />
      </div>
    </div>
  )
}
