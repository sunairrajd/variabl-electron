import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { LogOut } from 'lucide-react'

export default function InactiveScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const logout = useAuthStore((s) => s.logout)
  const defaultScreenName = useAuthStore((s) => s.screenName)
  const authDisplayId = useAuthStore((s) => s.displayId)
  const selectedMonitorId = useAppStore((s) => s.selectedMonitorId)
  const [deviceInfo, setDeviceInfo] = useState<any>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('variableDevice')
      if (stored) {
        setDeviceInfo(JSON.parse(stored))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  const currentScreen = deviceInfo?.screens?.find((s: any) => s.displayId === (selectedMonitorId ? String(selectedMonitorId) : authDisplayId))
  const displayName = currentScreen?.monitorModel || currentScreen?.screenName || defaultScreenName || 'This screen'

  const handleLogout = () => {
    logout()
    navigate('onboarding')
  }

  return (
    <AuroraBackground className="w-full relative">
      <div className="flex flex-col justify-center items-center w-full h-full p-[3vw] gap-[2vw] opacity-0 animate-screen-enter">
        {/* Title Area */}
        <div className="w-full flex flex-col items-center">
          <div className="text-center max-w-[45vw] min-w-[320px]">
            <h1 className="text-[clamp(1.2rem,2vw,2.8rem)] font-light text-slate-700 mb-[1vw] tracking-[-1px] leading-[1.1]">
              '{displayName}' is currently inactive
            </h1>
            <p className="text-[clamp(0.75rem,0.9vw,1.2rem)] font-normal text-slate-400">
              Resume playback on this device or control screens remotely from www.variabl.co
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col justify-center items-center gap-[1vw] mt-[2vw]">
          <Button
            onClick={() => {
              if (selectedMonitorId && useAppStore.getState().monitorAssignments[selectedMonitorId]) {
                useAppStore.getState().setSelectedPlaylist(useAppStore.getState().monitorAssignments[selectedMonitorId]!)
                navigate('player')
              } else if (useAppStore.getState().selectedPlaylist) {
                navigate('player')
              } else {
                navigate('onboarding')
              }
            }}
            className="rounded-xl bg-[#2a2a2a] hover:bg-black text-white px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium cursor-pointer transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] hover:shadow-lg hover:shadow-black/5 animate-cta-enter"
          >
            Resume playback
          </Button>
          <Button
            onClick={() => window.electronAPI.invoke('open-external', 'https://variabl.co/app')}
            className="rounded-xl bg-slate-200/60 border-0 text-slate-700 hover:text-slate-900 hover:bg-slate-300/60 px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium cursor-pointer transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] animate-cta-enter backdrop-blur-sm"
          >
            Manage this screen on variabl.co
          </Button>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="rounded-xl bg-red-100/60 text-red-600 hover:text-red-700 hover:bg-red-200/60 px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium cursor-pointer transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] animate-cta-enter gap-2 backdrop-blur-sm"
          >
            <LogOut className="w-4 h-4 md:w-5 md:h-5" />
            Logout
          </Button>
        </div>

        {/* Device & Screens Info */}
        {deviceInfo && (
          <div className="mt-[3vw] w-full max-w-[600px] bg-white/40 backdrop-blur-md rounded-2xl p-[2vw] border border-white/20 shadow-xl overflow-y-auto max-h-[30vh]">
            <h2 className="text-slate-800 font-semibold text-[clamp(1rem,1.2vw,1.5rem)] mb-[1vw] border-b border-slate-300/50 pb-[0.5vw]">
              Device Details
            </h2>
            <div className="flex flex-col gap-[0.5vw] text-slate-600 text-[clamp(0.75rem,0.9vw,1.1rem)]">
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Device ID:</span>
                <span className="font-mono bg-slate-200/50 px-2 py-0.5 rounded text-slate-700">{deviceInfo.deviceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">Device Name:</span>
                <span className="text-slate-800">{deviceInfo.deviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-500">OS:</span>
                <span className="text-slate-800">{deviceInfo.os}</span>
              </div>
              
              {deviceInfo.screens && deviceInfo.screens.length > 0 && (
                <div className="mt-[1vw]">
                  <h3 className="text-slate-700 font-medium text-[clamp(0.9rem,1vw,1.2rem)] mb-[0.5vw]">{deviceInfo.deviceName} Screens</h3>
                  <div className="flex flex-col gap-[0.8vw]">
                    {deviceInfo.screens.map((screen: any, idx: number) => (
                      <div key={screen.screenId || idx} className="bg-white/50 rounded-xl p-[1vw] border border-white/30 flex flex-col gap-[0.3vw]">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-slate-800 text-[clamp(0.85rem,1vw,1.2rem)]">{screen.screenName || `Screen ${idx + 1}`}</span>
                          <span className="text-[clamp(0.7rem,0.8vw,1rem)] text-slate-500 font-mono">ID: {screen.screenId}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-[1vw] text-[clamp(0.75rem,0.85vw,1rem)] text-slate-600 mt-[0.3vw]">
                          <span><strong className="font-medium text-slate-500">Model:</strong> {screen.monitorModel || 'N/A'}</span>
                          <span><strong className="font-medium text-slate-500">Resolution:</strong> {screen.width}x{screen.height}</span>
                          <span><strong className="font-medium text-slate-500">Position:</strong> {screen.x}, {screen.y}</span>
                          <span><strong className="font-medium text-slate-500">Display ID:</strong> {screen.displayId}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AuroraBackground>
  )
}

