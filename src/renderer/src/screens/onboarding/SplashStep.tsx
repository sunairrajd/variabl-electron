import { useEffect } from 'react'
import tabRevolverLogo from '../../assets/tabrevolver.svg'
import variablLogo from '../../assets/variabl.svg'

interface SplashStepProps {
  onNext: () => void
}

export default function SplashStep({ onNext }: SplashStepProps) {
  useEffect(() => {
    // Automatically transition after a short delay
    const timer = setTimeout(onNext, 3000)
    return () => clearTimeout(timer)
  }, [onNext])

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex items-center gap-[6vw]">
        <img src={variablLogo} alt="Variabl" className="h-[clamp(1.25rem,1.8vw,4.5rem)] w-auto object-contain opacity-0 animate-reveal [animation-delay:800ms]" />
        {/* <div className="h-[clamp(1.25rem,2vw,4.5rem)] w-px bg-slate-300" /> */}
        <img src={tabRevolverLogo} alt="Tab Revolver" className="h-[clamp(1.25rem,1.8vw,4.5rem)] w-auto object-contain opacity-0 animate-reveal [animation-delay:800ms]" />
      </div>
    </div>
  )
}
