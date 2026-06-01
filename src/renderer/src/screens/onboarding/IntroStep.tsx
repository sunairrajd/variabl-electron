import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface IntroStepProps {
  onNext: () => void
  onBack?: () => void
}

export default function IntroStep({ onNext, onBack }: IntroStepProps) {
  return (
    <div className="flex flex-col justify-between items-center w-full h-full p-[3vw] opacity-0 animate-screen-enter">
      {/* Pinned Header */}
      <div className="w-full flex items-center justify-between">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex h-[clamp(2.5rem,3.2vw,4.5rem)] w-[clamp(2.5rem,3.2vw,4.5rem)] items-center justify-center rounded-full bg-white/80 hover:bg-white text-slate-600 shadow-sm border border-black/5 transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.95] cursor-pointer"
          >
            <ArrowLeft className="h-[clamp(1.2rem,1.5vw,2rem)] w-[clamp(1.2rem,1.5vw,2rem)]" />
          </button>
        ) : (
          <div className="h-[clamp(2.5rem,3.2vw,4.5rem)] w-[clamp(2.5rem,3.2vw,4.5rem)] opacity-0" />
        )}
        <div className="h-[clamp(2.5rem,3.2vw,4.5rem)]" /> {/* Spacer/Right slots if needed */}
      </div>

      {/* Centered Content */}
      <div className="flex flex-col items-center justify-center flex-1 my-[2vw]">
        <div className="text-center max-w-[45vw] min-w-[320px] mb-[2.5vw]">
          <h1 className="text-[clamp(1.2rem,2vw,2.8rem)] font-light text-slate-700 mb-[1vw] tracking-[-1px] leading-[1.1]">
            Turn any screen into a live dashboard or digital signage display
          </h1>
          <p className="text-[clamp(0.75rem,0.9vw,1.2rem)] font-normal text-slate-400">
            Display dashboards, videos, websites, and playlists in fullscreen mode
          </p>
        </div>

        {/* Video placeholder */}
        <div className="p-[1.2vw] rounded-[1.5vw] bg-white/80 h-auto border border-black/5 shadow-sm">
          <div className="w-[50vw] max-w-[1200px] min-w-[300px] aspect-[2/1] rounded-[1vw] bg-[#eef1e6] border border-black/5" />
        </div>
      </div>

      {/* Pinned Footer (Supports two stacked buttons) */}
      <div className="w-full flex flex-col justify-center items-center gap-[1vw]">
        <Button
          onClick={onNext}
          className="rounded-xl bg-[#2a2a2a] hover:bg-black text-white px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium cursor-pointer transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] hover:shadow-lg hover:shadow-black/5"
        >
          Get started
        </Button>
        {onBack && (
          <Button
            onClick={onBack}
            variant="outline"
            className="rounded-xl border-slate-200 bg-white/50 text-slate-700 px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium cursor-pointer transition-all duration-200 ease-out hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.97]"
          >
            Back
          </Button>
        )}
      </div>
    </div>
  )
}
