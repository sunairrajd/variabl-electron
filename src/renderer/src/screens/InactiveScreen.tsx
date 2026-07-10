import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { X, Monitor, ExternalLink, MoreHorizontal, LogOut, RefreshCw } from 'lucide-react'
import { db, doc, onSnapshot } from '@/lib/firebase'
import { getStoredScreenId } from '@/services/DeviceSyncService'
import { trackEvent } from '@/lib/analytics'

export default function InactiveScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const isUpdateReady = useAppStore((s) => s.isUpdateReady)
  const logout = useAuthStore((s) => s.logout)
  const userEmail = useAuthStore((s) => s.firebaseUser?.email)
  const defaultScreenName = useAuthStore((s) => s.screenName)
  const authDisplayId = useAuthStore((s) => s.displayId)
  const selectedMonitorId = useAppStore((s) => s.selectedMonitorId)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [deviceInfo, setDeviceInfo] = useState<any>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [firebaseScreenName, setFirebaseScreenName] = useState<string | null>(null)
  const [showExitDialog, setShowExitDialog] = useState(false)

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

  useEffect(() => {
    const displayIdToUse = selectedMonitorId ? String(selectedMonitorId) : authDisplayId
    if (!displayIdToUse) return

    const screenId = getStoredScreenId(displayIdToUse)

    const unsubscribe = onSnapshot(doc(db, 'screens', screenId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        if (data?.screenName) {
          setFirebaseScreenName(data.screenName)

          // Also update local storage variableDevice so it persists
          try {
            const stored = localStorage.getItem('variableDevice')
            if (stored) {
              const variableDevice = JSON.parse(stored)
              if (variableDevice.screens) {
                const screenIdx = variableDevice.screens.findIndex((s: any) => s.displayId === displayIdToUse)
                if (screenIdx !== -1) {
                  variableDevice.screens[screenIdx].screenName = data.screenName
                  localStorage.setItem('variableDevice', JSON.stringify(variableDevice))
                  setDeviceInfo(variableDevice)
                }
              }
            }
          } catch (e) {
            console.error('Failed to update screenName in localStorage:', e)
          }
        }
      }
    })

    return () => unsubscribe()
  }, [authDisplayId, selectedMonitorId])

  // Arrow key navigation & Escape handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const active = document.activeElement;
        
        // If exit dialog is open, restrict focus navigation to the dialog container (focus trap)
        const container = showExitDialog
          ? document.querySelector('.bg-white.rounded-3xl')
          : document.body;

        if (!container) return;

        const focusables = Array.from(
          container.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), [tabindex="0"]:not([disabled])'
          )
        ) as HTMLElement[];

        if (focusables.length === 0) return;

        e.preventDefault();
        const currentIndex = focusables.indexOf(active as HTMLElement);
        let nextIndex = 0;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % focusables.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          nextIndex = currentIndex === -1 ? focusables.length - 1 : (currentIndex - 1 + focusables.length) % focusables.length;
        }

        focusables[nextIndex].focus();
      } else if (e.key === 'Escape') {
        if (showExitDialog) {
          setShowExitDialog(false);
        } else if (isMenuOpen) {
          setIsMenuOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showExitDialog, isMenuOpen]);

  // Auto-focus dialog buttons when the Exit Dialog opens
  useEffect(() => {
    if (showExitDialog) {
      setTimeout(() => {
        const cancelButton = document.querySelector('.bg-white.rounded-3xl button') as HTMLElement;
        if (cancelButton) cancelButton.focus();
      }, 50);
    }
  }, [showExitDialog]);

  const currentScreen = deviceInfo?.screens?.find((s: any) => s.displayId === (selectedMonitorId ? String(selectedMonitorId) : authDisplayId))
  const displayName = firebaseScreenName || currentScreen?.screenName || currentScreen?.monitorModel || defaultScreenName || 'This screen'

  const handleLogout = () => {
    window.electronAPI.invoke('logout-all').catch(console.error)
  }

  const handleExitDisplay = () => {
    trackEvent('click_exit_display_attempt')
    setShowExitDialog(true)
  }

  const confirmExitDisplay = () => {
    trackEvent('confirm_exit_display')
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
                {userEmail && (
                  <div className="px-4 py-2 mb-1 border-b border-slate-100">
                    <p className="text-xs font-medium text-slate-500 truncate" title={userEmail}>
                      {userEmail}
                    </p>
                  </div>
                )}
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

      {/* Exit Confirmation Dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-[2vw] max-w-[400px] w-full mx-4 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 border border-slate-100">
            <h4 className="text-[clamp(1rem,1.2vw,1.4rem)] font-medium text-slate-800 mb-[0.5vw]">Exit Player</h4>
            <p className="text-slate-500/90 mb-[2vw] text-[clamp(0.8rem,0.9vw,1rem)] leading-relaxed max-w-[280px]">
              Are you sure you want to close the player on this display?
            </p>
            <div className="flex w-full gap-[0.8vw]">
              <Button
                variant="ghost"
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-600 h-[clamp(2.5rem,3vw,3.5rem)] text-[clamp(0.8rem,0.9vw,1rem)] rounded-2xl transition-all duration-200"
                onClick={() => {
                  setShowExitDialog(false);
                  trackEvent('cancel_exit_display');
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white h-[clamp(2.5rem,3vw,3.5rem)] text-[clamp(0.8rem,0.9vw,1rem)] rounded-2xl transition-all duration-200"
                onClick={confirmExitDisplay}
              >
                Exit
              </Button>
            </div>
          </div>
        </div>
      )}
    </AuroraBackground>
  )
}

