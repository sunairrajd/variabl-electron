import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { X, Monitor, ExternalLink, MoreHorizontal, LogOut, RefreshCw } from 'lucide-react'

export default function InactiveScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const isUpdateReady = useAppStore((s) => s.isUpdateReady)
  const logout = useAuthStore((s) => s.logout)
  const defaultScreenName = useAuthStore((s) => s.screenName)
  const authDisplayId = useAuthStore((s) => s.displayId)
  const selectedMonitorId = useAppStore((s) => s.selectedMonitorId)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [deviceInfo, setDeviceInfo] = useState<any>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  const currentScreen = deviceInfo?.screens?.find((s: any) => s.displayId === (selectedMonitorId ? String(selectedMonitorId) : authDisplayId))
  const displayName = currentScreen?.monitorModel || currentScreen?.screenName || defaultScreenName || 'This screen'

  const handleLogout = () => {
    window.electronAPI.invoke('logout-all').catch(console.error)
  }

  const handleExitDisplay = () => {
    window.close()
  }

  return (
    <AuroraBackground className="w-full relative">
      <div className="flex flex-col justify-between items-center w-full h-full p-[3vw] opacity-0 animate-screen-enter relative z-10">

        <div className="absolute top-2 right-4 pointer-events-auto flex items-center gap-2 z-50">
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-slate-400 hover:text-slate-600 hover:bg-black/5 p-2 rounded-full transition-colors flex items-center justify-center"
            >
              <MoreHorizontal className="h-7 w-7" strokeWidth={2.5} />
            </button>
            {isMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200/50 p-2 shadow-2xl">
                {isUpdateReady && (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false)
                      window.electronAPI.invoke('install-update')
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Restart to update</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsMenuOpen(false)
                    handleLogout()
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleExitDisplay}
            className="text-slate-400 hover:text-slate-600 hover:bg-black/5 p-2 rounded-full transition-colors flex items-center justify-center"
          >
            <X className="h-7 w-7" strokeWidth={2.5} />
          </button>
        </div>

        {/* Pinned Header Spacer & Title Area */}
        <div className="w-full flex flex-col items-center">
          <div className="w-full flex items-center justify-between relative">
            <div className="h-[clamp(2.5rem,3.2vw,4.5rem)] w-[clamp(2.5rem,3.2vw,4.5rem)] opacity-0" />
            <div className="h-[clamp(2.5rem,3.2vw,4.5rem)] opacity-0" />
          </div>

          <div className="text-center max-w-[45vw] min-w-[320px] mt-[1vw]">
            <h1 className="text-[clamp(1.2rem,2vw,2.8rem)] font-light text-slate-700 mb-[1vw] tracking-[-1px] leading-[1.1]">
              Nothing Playing
            </h1>
            <p className="text-[clamp(0.75rem,0.9vw,1.2rem)] font-normal text-slate-400">
              This display is online and not playing any content.
            </p>
          </div>
        </div>

        {/* Centered Content */}
        <div className="flex flex-col items-center justify-center flex-1 my-[2vw] relative w-full">
          {/* VARIABL.CO watermark */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none -z-10">
            {/* <h1 className="text-[8vw] font-black text-[#D3E8E8]/60 tracking-tight select-none">
              VARIABL.CO
            </h1> */}
          </div>

          {/* Card */}
          <div className="bg-white/60 backdrop-blur-md rounded-[1.5vw] py-[2vw] px-[3vw] border border-white/80 shadow-sm flex flex-col items-center min-w-[340px]">
            <Monitor className="w-[2vw] h-[2vw] min-w-[24px] min-h-[24px] text-slate-400 mb-[1vw]" strokeWidth={1.5} />
            <h2 className="text-slate-600 font-semibold text-[clamp(0.9rem,1.1vw,1.3rem)] mb-[0.3vw]">{displayName}</h2>
            <p className="text-slate-500/80 text-[clamp(0.7rem,0.8vw,1rem)] mb-[1.5vw] tracking-wide">
              {deviceInfo?.computerName || 'Unknown'}
            </p>
            {isOnline ? (
              <div className="bg-[#EAF5EC] text-[#347D39] text-[clamp(0.6rem,0.7vw,0.8rem)] font-medium px-[1vw] py-[0.5vw] rounded-full flex items-center gap-[0.5vw]">
                <div className="w-[0.4vw] h-[0.4vw] min-w-[6px] min-h-[6px] rounded-full bg-[#46A758]"></div>
                Online
              </div>
            ) : (
              <div className="bg-[#FDF0F0] text-[#C2412E] text-[clamp(0.6rem,0.7vw,0.8rem)] font-medium px-[1vw] py-[0.5vw] rounded-full flex items-center gap-[0.5vw]">
                <div className="w-[0.4vw] h-[0.4vw] min-w-[6px] min-h-[6px] rounded-full bg-[#E13A3A]"></div>
                Offline
              </div>
            )}
          </div>
        </div>

        {/* Pinned Footer */}
        <div className="w-full flex flex-col justify-center items-center gap-[1vw]">
          <p className="text-slate-500 text-[clamp(0.75rem,0.9vw,1.1rem)] mb-[0.5vw]">
            Manage this display at <span className="font-bold text-slate-600">variabl.co/app</span>
          </p>
          <Button
            onClick={() => window.electronAPI.invoke('open-external', 'https://variabl.co/app/screens')}
            className="rounded-xl bg-[#2a2a2a] hover:bg-black text-white px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium cursor-pointer transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] hover:shadow-lg hover:shadow-black/5 flex items-center justify-center gap-2"
          >
            Manage display <ExternalLink className="w-[clamp(1rem,1.2vw,1.5rem)] h-[clamp(1rem,1.2vw,1.5rem)]" strokeWidth={1.5} />
          </Button>
          <Button
            onClick={handleExitDisplay}
            variant="ghost"
            className="rounded-xl bg-white hover:bg-gray-50 text-slate-700 hover:text-slate-800 border border-slate-200 px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium cursor-pointer transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] hover:shadow-lg hover:shadow-black/5 flex items-center justify-center gap-2"
          >
            Exit display
          </Button>
        </div>

      </div>
    </AuroraBackground>
  )
}

