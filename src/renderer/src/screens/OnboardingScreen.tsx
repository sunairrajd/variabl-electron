import { useState } from 'react'
import SplashStep from '@/screens/onboarding/SplashStep'
import IntroStep from '@/screens/onboarding/IntroStep'
import SignInStep from '@/screens/onboarding/SignInStep'
import PlaylistPickerStep from '@/screens/onboarding/PlaylistPickerStep'
import ReadyStep from '@/screens/onboarding/ReadyStep'
import { useAppStore } from '@/stores/useAppStore'

export type OnboardingStep = 'splash' | 'intro' | 'signin' | 'picker' | 'ready'

export default function OnboardingScreen() {
  const [step, setStep] = useState<OnboardingStep>('splash')
  const navigate = useAppStore((s) => s.navigate)

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white overflow-hidden">
      {step === 'splash' && <SplashStep onNext={() => setStep('intro')} />}
      {step === 'intro' && <IntroStep onNext={() => setStep('signin')} />}
      {step === 'signin' && (
        <SignInStep onNext={() => setStep('picker')} onBack={() => setStep('intro')} />
      )}
      {step === 'picker' && (
        <PlaylistPickerStep
          onNext={() => {
            setStep('ready')
            setTimeout(() => {
              navigate('player') // End of onboarding, go to player screen
            }, 3000)
          }}
          onBack={() => setStep('signin')}
        />
      )}
      {step === 'ready' && <ReadyStep />}
    </div>
  )
}
