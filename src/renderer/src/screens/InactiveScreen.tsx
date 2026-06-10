import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { LogOut } from 'lucide-react'

export default function InactiveScreen() {
  const navigate = useAppStore((s) => s.navigate)
  const logout = useAuthStore((s) => s.logout)

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
              This screen is currently inactive
            </h1>
            <p className="text-[clamp(0.75rem,0.9vw,1.2rem)] font-normal text-slate-400">
              Resume playback on this device or control playlists remotely from Variabl.co
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="w-full flex flex-col justify-center items-center gap-[1vw] mt-[2vw]">
          <Button
            onClick={() => navigate('player')}
            className="rounded-xl bg-[#2a2a2a] hover:bg-black text-white px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium cursor-pointer transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] hover:shadow-lg hover:shadow-black/5 animate-cta-enter"
          >
            Resume playback
          </Button>
          <Button
            onClick={() => window.electronAPI.invoke('open-external', 'https://variabl.co/app')}
            className="rounded-xl bg-slate-200/60 border-0 text-slate-700 hover:text-slate-900 hover:bg-slate-300/60 px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium cursor-pointer transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] animate-cta-enter backdrop-blur-sm"
          >
            Manage this screen on Variabl.co
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
      </div>
    </AuroraBackground>
  )
}
