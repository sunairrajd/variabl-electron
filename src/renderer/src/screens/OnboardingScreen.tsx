import { useEffect, useState } from 'react'
import SplashStep from '@/screens/onboarding/SplashStep'
import IntroStep from '@/screens/onboarding/IntroStep'
import SignInStep from '@/screens/onboarding/SignInStep'
import PlaylistPickerStep from '@/screens/onboarding/PlaylistPickerStep'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { rtdb, rtdbRef } from '@/lib/firebase'
import { get } from 'firebase/database'
import { ArrowLeft } from 'lucide-react'

import { AuroraBackground } from '@/components/ui/aurora-background'

export type OnboardingStep = 'splash' | 'intro' | 'signin' | 'picker'

export default function OnboardingScreen() {
  const [step, setStep] = useState<OnboardingStep>(() => {
    return sessionStorage.getItem('hasSeenSplash') === 'true'
      ? (localStorage.getItem('hasSeenIntro') === 'true' ? 'signin' : 'intro')
      : 'splash'
  })
  const navigate = useAppStore((s) => s.navigate)

  const [postSplashAction, setPostSplashAction] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (step !== 'splash') return

    const determineNextStep = async () => {
      const token = useAuthStore.getState().deviceToken
      const displayId = useAuthStore.getState().displayId

      if (!token) {
        setPostSplashAction(() => () => {
          sessionStorage.setItem('hasSeenSplash', 'true')
          setStep(localStorage.getItem('hasSeenIntro') === 'true' ? 'signin' : 'intro')
        })
        return
      }

      if (token && !displayId) {
        setPostSplashAction(() => () => {
          sessionStorage.setItem('hasSeenSplash', 'true')
          setStep('picker')
        })
        return
      }

      try {
        const snapshot = await get(rtdbRef(rtdb, `screens/${displayId}/nowPlayingPlaylistId`))
        const playlistId = snapshot.val()
        if (playlistId) {
          setPostSplashAction(() => () => {
            sessionStorage.setItem('hasSeenSplash', 'true')
            navigate('player')
          })
        } else {
          setPostSplashAction(() => () => {
            sessionStorage.setItem('hasSeenSplash', 'true')
            setStep('picker')
          })
        }
      } catch (err) {
        console.error('[Onboarding] Error checking RTDB:', err)
        setPostSplashAction(() => () => {
          sessionStorage.setItem('hasSeenSplash', 'true')
          setStep('picker')
        })
      }
    }

    determineNextStep()
  }, [step, navigate])

  const handleSplashComplete = () => {
    if (postSplashAction) {
      postSplashAction()
    } else {
      sessionStorage.setItem('hasSeenSplash', 'true')
      setStep(localStorage.getItem('hasSeenIntro') === 'true' ? 'signin' : 'intro')
    }
  }

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

      {step === 'splash' && <SplashStep onNext={handleSplashComplete} />}
      {step === 'intro' && <IntroStep onNext={() => {
        localStorage.setItem('hasSeenIntro', 'true')
        setStep('signin')
      }} onBack={handleBack} />}
      {step === 'signin' && (
        <SignInStep onNext={() => setStep('picker')} onBack={handleBack} />
      )}
      {step === 'picker' && (
        <PlaylistPickerStep
          onNext={() => {
            navigate('player')
          }}
          onBack={handleBack}
        />
      )}
    </AuroraBackground>
  )
}

