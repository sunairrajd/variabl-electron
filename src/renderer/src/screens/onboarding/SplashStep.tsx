import { useEffect } from 'react'
import tabRevolverLogo from '../../assets/tabrevolver.svg'
import variablLogo from '../../assets/variabl.svg'

interface SplashStepProps {
  onNext: () => void
}

export default function SplashStep({ onNext }: SplashStepProps) {
  useEffect(() => {
    // Automatically transition after a short delay
    const timer = setTimeout(onNext, 10000)
    return () => clearTimeout(timer)
  }, [onNext])

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex items-center gap-24">
        <img src={variablLogo} alt="Variabl" className="h-6 w-auto object-contain" />
        {/* <div className="h-6 w-px bg-slate-300" /> */}
        <img src={tabRevolverLogo} alt="Tab Revolver" className="h-6 w-auto object-contain" />
      </div>
    </div>
  )
}
