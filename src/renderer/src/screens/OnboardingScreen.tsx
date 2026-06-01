import { useState } from 'react'
import SplashStep from '@/screens/onboarding/SplashStep'
import IntroStep from '@/screens/onboarding/IntroStep'
import SignInStep from '@/screens/onboarding/SignInStep'
import PlaylistPickerStep from '@/screens/onboarding/PlaylistPickerStep'
import { useAppStore } from '@/stores/useAppStore'
import { ArrowLeft } from 'lucide-react'

import { AuroraBackground } from '@/components/ui/aurora-background'

export type OnboardingStep = 'splash' | 'intro' | 'signin' | 'picker'

export default function OnboardingScreen() {
  const [step, setStep] = useState<OnboardingStep>('splash')
  const navigate = useAppStore((s) => s.navigate)

  const showBackButton = step !== 'splash'
  const handleBack = () => {
    if (step === 'intro') setStep('splash')
    else if (step === 'signin') setStep('intro')
    else if (step === 'picker') setStep('signin')
  }

  return (
    <AuroraBackground className="w-full relative">
      {showBackButton && (
        <button
          onClick={handleBack}
          className="fixed left-[3vw] top-[3vw] z-50 flex h-[clamp(2.5rem,3.2vw,4.5rem)] w-[clamp(2.5rem,3.2vw,4.5rem)] items-center justify-center rounded-full bg-white/80 hover:bg-white text-slate-600 shadow-sm border border-black/5 transition-all duration-200 ease-out hover:scale-[1.05] active:scale-[0.95] cursor-pointer"
        >
          <ArrowLeft className="h-[clamp(1.2rem,1.5vw,2rem)] w-[clamp(1.2rem,1.5vw,2rem)]" />
        </button>
      )}

      {step === 'splash' && <SplashStep onNext={() => setStep('intro')} />}
      {step === 'intro' && <IntroStep onNext={() => setStep('signin')} onBack={handleBack} />}
      {step === 'signin' && (
        <SignInStep onNext={() => setStep('picker')} onBack={handleBack} />
      )}
      {step === 'picker' && (
        <PlaylistPickerStep
          onNext={() => {
            navigate('player') // End of onboarding, go to player screen
          }}
          onBack={handleBack}
        />
      )}
    </AuroraBackground>
  )
}

