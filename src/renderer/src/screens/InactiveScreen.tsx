import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/useAppStore'
import { AuroraBackground } from '@/components/ui/aurora-background'

export default function InactiveScreen() {
  const navigate = useAppStore((s) => s.navigate)

  return (
    <AuroraBackground className="w-full relative">
      <div className="flex flex-col justify-between items-center w-full h-full p-[3vw] opacity-0 animate-screen-enter">
        {/* Pinned Header Spacer & Title Area */}
        <div className="w-full flex flex-col items-center">
          <div className="w-full flex items-center justify-between">
            <div className="h-[clamp(2.5rem,3.2vw,4.5rem)] w-[clamp(2.5rem,3.2vw,4.5rem)] opacity-0" />
            <div className="h-[clamp(2.5rem,3.2vw,4.5rem)]" />
          </div>

          <div className="text-center max-w-[45vw] min-w-[320px] mt-[1vw]">
            <h1 className="text-[clamp(1.2rem,2vw,2.8rem)] font-light text-slate-700 mb-[1vw] tracking-[-1px] leading-[1.1]">
              This screen is currently inactive
            </h1>
            <p className="text-[clamp(0.75rem,0.9vw,1.2rem)] font-normal text-slate-400">
              Resume playback on this device or control playlists remotely from Variabl.co
            </p>
          </div>
        </div>


        {/* <div className="flex flex-col items-center justify-center flex-1 my-[2vw]">
        
          <div className="p-[1.2vw] rounded-[1.5vw] bg-white/80 h-auto border border-black/5">
            <div className="w-[50vw] max-w-[1200px] min-w-[300px] aspect-[2/1] rounded-[1vw] bg-[#eef1e6] border border-black/5" />
          </div>
        </div> */}

        {/* Pinned Footer (Supports two stacked buttons) */}
        <div className="w-full flex flex-col justify-center items-center gap-[1vw]">
          <Button
            onClick={() => navigate('player')}
            className="rounded-xl bg-[#2a2a2a] hover:bg-black text-white px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium cursor-pointer transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] hover:shadow-lg hover:shadow-black/5 animate-cta-enter"
          >
            Resume playback
          </Button>
          <Button
            onClick={() => window.electronAPI.invoke('open-external', 'https://variabl.co/app')}
            className="rounded-xl bg-transparent border-0 text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium cursor-pointer transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] animate-cta-enter"
          >
            Manage this screen on Variabl.co
          </Button>
        </div>
      </div>
    </AuroraBackground>
  )
}
