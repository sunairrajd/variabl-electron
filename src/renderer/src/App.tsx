import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

function App(): React.JSX.Element {
  const [monitorCount, setMonitorCount] = useState<number | null>(null)

  useEffect(() => {
    window.electronAPI.invoke('get-monitors').then((monitors) => {
      setMonitorCount(monitors.length)
    })
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <h1 className="text-4xl font-bold text-foreground">Tab Revolver Player</h1>
      <p className="text-muted-foreground">
        {monitorCount === null
          ? 'Querying displays…'
          : `IPC OK — ${monitorCount} display(s) detected`}
      </p>
      <Button>Get Started</Button>
    </div>
  )
}

export default App
