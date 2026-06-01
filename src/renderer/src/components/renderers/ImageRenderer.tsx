import { PlaylistTab } from '@/stores/useAppStore'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  tab: PlaylistTab
  isActive: boolean
  onReady: () => void
  onFail: () => void
}

export default function ImageRenderer({ tab, isActive, onReady, onFail }: Props) {
  const [loaded, setLoaded] = useState(false)

  const handleLoad = () => {
    setLoaded(true)
    onReady()
  }

  const bgColor = tab.backgroundColor || 'black'
  const objectFitClass = tab.scale === 'fill' ? 'object-cover' : 'object-contain'

  return (
    <div 
      className="w-full h-full overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: bgColor }}
    >
      <img
        src={tab.url}
        alt={tab.title}
        onLoad={handleLoad}
        onError={onFail}
        className={cn(
          "w-full h-full",
          objectFitClass
        )}
      />
    </div>
  )
}
