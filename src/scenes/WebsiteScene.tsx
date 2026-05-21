import { useEffect } from 'react'

interface WebsiteSceneProps {
  url: string
}

export function WebsiteScene({ url }: WebsiteSceneProps) {
  useEffect(() => {
    // Tell main process to create and show WebContentsView overlay
    // @ts-ignore
    if (window.electron) {
      // @ts-ignore
      window.electron.ipcRenderer.invoke('show-website', { url })
    }

    return () => {
      // Clean up the view when changing scenes
      // @ts-ignore
      if (window.electron) {
        // @ts-ignore
        window.electron.ipcRenderer.invoke('hide-website')
      }
    }
  }, [url])

  return (
    <div className="w-full h-full bg-black flex items-center justify-center">
      {/* Fallback for browser mode or while loading */}
      <div className="text-text-muted flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p>Loading {url}</p>
      </div>
    </div>
  )
}
