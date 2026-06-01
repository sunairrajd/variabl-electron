import { PlaylistTab } from '@/stores/useAppStore'
import { useEffect, useRef } from 'react'

interface Props {
  tab: PlaylistTab
  isActive: boolean
  onReady: () => void
  onFail: () => void
}

export default function GSheetRenderer({ tab, isActive, onReady, onFail }: Props) {
  const onReadyRef = useRef(onReady)
  const onFailRef = useRef(onFail)

  useEffect(() => {
    onReadyRef.current = onReady
    onFailRef.current = onFail
  }, [onReady, onFail])

  const handleLoad = () => {
    // Adding a slight delay to ensure the content is fully rendered before firing onReady
    setTimeout(() => {
      onReadyRef.current()
    }, 300)
  }

  const handleError = () => {
    onFailRef.current()
  }

  // Format the URL to embed beautifully (hide headers, chrome, etc)
  let embedUrl = tab.url;
  try {
    const urlObj = new URL(embedUrl);
    if (embedUrl.includes('/pubhtml')) {
      urlObj.searchParams.set('widget', 'true');
      urlObj.searchParams.set('headers', 'false');
      urlObj.searchParams.set('chrome', 'false');
      embedUrl = urlObj.toString();
    }
  } catch (e) {
    // if URL parsing fails, we fallback to original
  }

  return (
    <div className="w-full h-full bg-white relative">
      <iframe
        src={embedUrl}
        onLoad={handleLoad}
        onError={handleError}
        className="w-full h-full border-none"
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  )
}
