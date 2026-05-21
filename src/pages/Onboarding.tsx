import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/useAppStore'
import { Monitor } from '../types'
import { Monitor as MonitorIcon, Play } from 'lucide-react'

export function Onboarding() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const { setState, selectedMonitor, setSelectedMonitor } = useAppStore()

  useEffect(() => {
    // Fetch monitors from Electron IPC
    // @ts-ignore
    window.electron?.ipcRenderer.invoke('get-monitors').then((displays: Monitor[]) => {
      setMonitors(displays)
      const primary = displays.find((d) => d.isPrimary)
      if (primary) {
        setSelectedMonitor(primary.id)
      }
    }).catch((err: any) => {
      console.warn("Not in Electron environment, skipping monitors", err)
    })
  }, [])

  const handleStart = async () => {
    if (selectedMonitor) {
      // @ts-ignore
      await window.electron?.ipcRenderer.invoke('set-primary-display', selectedMonitor)
    }
    setState('player')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-2xl w-full p-10 bg-surface rounded-2xl shadow-2xl border border-white/5">
        <h2 className="text-3xl font-bold text-white mb-2">Welcome to Player</h2>
        <p className="text-text-muted mb-8">Choose a display to start digital signage</p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          {monitors.map((monitor) => (
            <div
              key={monitor.id}
              onClick={() => setSelectedMonitor(monitor.id)}
              className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                selectedMonitor === monitor.id
                  ? 'border-primary bg-primary/10'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              <MonitorIcon className="mb-4 text-white" size={32} />
              <h3 className="text-lg font-medium text-white">{monitor.label}</h3>
              <p className="text-sm text-text-muted">
                {monitor.bounds.width}x{monitor.bounds.height}
              </p>
              {monitor.isPrimary && (
                <span className="inline-block mt-2 px-2 py-1 bg-white/10 rounded text-xs text-text-muted">
                  Primary
                </span>
              )}
            </div>
          ))}
          {monitors.length === 0 && (
            <div className="col-span-2 text-center py-12 text-text-muted">
              Running in browser mode. Monitors will only appear in the Electron app.
            </div>
          )}
        </div>

        <button
          onClick={handleStart}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium transition-colors flex justify-center items-center gap-2 text-lg"
        >
          <Play size={20} />
          Start Playback
        </button>
      </div>
    </div>
  )
}
