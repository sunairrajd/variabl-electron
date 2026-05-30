import { Button } from '@/components/ui/button'

interface IntroStepProps {
  onNext: () => void
}

export default function IntroStep({ onNext }: IntroStepProps) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-b from-white to-[#e0f2fe] p-12">
      <div className="text-center max-w-lg mb-8">
        <h1 className="text-3xl font-medium text-slate-800 mb-3 leading-tight">
          Turn any screen into a live dashboard or digital signage display
        </h1>
        <p className="text-sm text-slate-400">
          Display dashboards, videos, websites, and playlists in fullscreen mode.
        </p>
      </div>
      
      {/* Video placeholder */}
      <div className="w-full max-w-[700px] aspect-[2/1] rounded-2xl bg-[#eef1e6] mb-8 shadow-inner border border-black/5" />
      
      <Button 
        onClick={onNext}
        className="rounded-full bg-[#2a2a2a] hover:bg-black text-white px-8 h-10 font-medium"
      >
        Get started
      </Button>
    </div>
  )
}
