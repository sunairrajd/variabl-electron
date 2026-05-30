import { useEffect } from 'react'

interface SplashStepProps {
  onNext: () => void
}

export default function SplashStep({ onNext }: SplashStepProps) {
  useEffect(() => {
    // Automatically transition after a short delay
    const timer = setTimeout(onNext, 2000)
    return () => clearTimeout(timer)
  }, [onNext])

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#f4fbff]">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 font-bold text-slate-800 tracking-widest text-lg">
          <span className="text-[#84cc16]">✥</span> VARIABL
        </div>
        <div className="h-6 w-px bg-slate-300" />
        <div className="flex items-center gap-2 text-slate-600 font-medium">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-[#84cc16] text-white">
            ⟳
          </span>
          Tab Revolver
        </div>
      </div>
    </div>
  )
}
