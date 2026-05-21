import { useEffect } from 'react'
import { usePlaylistStore } from '../stores/usePlaylistStore'
import { SceneRenderer } from '../scenes/SceneRenderer'

export function Player() {
  const { items, currentIndex, isPlaying, next } = usePlaylistStore()

  useEffect(() => {
    if (!isPlaying || items.length === 0) return

    const currentItem = items[currentIndex]
    
    // Auto advance based on duration
    const timer = setTimeout(() => {
      next()
    }, currentItem.duration * 1000)

    return () => clearTimeout(timer)
  }, [currentIndex, items, isPlaying, next])

  if (items.length === 0) {
    return <div className="flex items-center justify-center h-full">No items in playlist</div>
  }

  const currentItem = items[currentIndex]

  return (
    <div className="w-full h-full bg-black relative">
      <SceneRenderer item={currentItem} />
      
      {/* Hidden dev controls / progress indicator */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10 z-50">
        <div 
          className="h-full bg-primary transition-all duration-[1000ms] ease-linear"
          style={{ 
            animation: `progress ${currentItem.duration}s linear infinite`,
          }}
        />
      </div>
      <style>{`
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}
