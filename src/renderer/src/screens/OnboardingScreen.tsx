import { useState } from 'react'
import SplashStep from '@/screens/onboarding/SplashStep'
import IntroStep from '@/screens/onboarding/IntroStep'
import NameStep from '@/screens/onboarding/NameStep'
import SignInStep from '@/screens/onboarding/SignInStep'
import PlaylistPickerStep from '@/screens/onboarding/PlaylistPickerStep'
import ReadyStep from '@/screens/onboarding/ReadyStep'
import { useAppStore } from '@/stores/useAppStore'

import { AuroraBackground } from '@/components/ui/aurora-background'

export type OnboardingStep = 'splash' | 'intro' | 'name' | 'signin' | 'picker' | 'ready'

export default function OnboardingScreen() {
  const [step, setStep] = useState<OnboardingStep>('splash')
  const navigate = useAppStore((s) => s.navigate)

  return (
    <AuroraBackground className="w-full">
      {step === 'splash' && <SplashStep onNext={() => setStep('intro')} />}
      {step === 'intro' && <IntroStep onNext={() => setStep('name')} onBack={() => setStep('splash')} />}
      {step === 'name' && <NameStep onNext={() => setStep('signin')} onBack={() => setStep('intro')} />}
      {step === 'signin' && (
        <SignInStep onNext={() => setStep('picker')} onBack={() => setStep('name')} />
      )}
      {step === 'picker' && (
        <PlaylistPickerStep
          onNext={() => {
            setStep('ready')
            setTimeout(() => {
              navigate('player') // End of onboarding, go to player screen
            }, 200)
          }}
          onBack={() => setStep('signin')}
        />
      )}
      {step === 'ready' && <ReadyStep />}
    </AuroraBackground>
  )
}

