import { useEffect, useState } from 'react'
import SplashStep from '@/screens/onboarding/SplashStep'
import IntroStep from '@/screens/onboarding/IntroStep'
import SignInStep from '@/screens/onboarding/SignInStep'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { db, doc, getDoc } from '@/lib/firebase'
import { ArrowLeft } from 'lucide-react'

import { AuroraBackground } from '@/components/ui/aurora-background'

export type OnboardingStep = 'splash' | 'intro' | 'signin' | 'checking'

export default function OnboardingScreen() {
  const [step, setStep] = useState<OnboardingStep>(() => {
    return sessionStorage.getItem('hasSeenSplash') === 'true'
      ? (localStorage.getItem('hasSeenIntro') === 'true' ? 'signin' : 'intro')
      : 'splash'
  })
  const navigate = useAppStore((s) => s.navigate)

  const [postSplashAction, setPostSplashAction] = useState<(() => void) | null>(null)
  const [isOffline, setIsOffline] = useState(false)

  const checkNetworkAndProceed = async () => {
    setIsOffline(false)
    setPostSplashAction(null)
    setStep('splash')
  }

  useEffect(() => {
    if (step !== 'splash' && step !== 'checking') return

    const executeOrQueue = (action: () => void) => {
      if (step === 'checking') {
        action()
      } else {
        setPostSplashAction(() => action)
      }
    }

    const determineNextStep = async () => {
      const token = useAuthStore.getState().deviceToken
      const displayId = useAuthStore.getState().displayId

      if (!token) {
        executeOrQueue(() => {
          sessionStorage.setItem('hasSeenSplash', 'true')
          setStep(localStorage.getItem('hasSeenIntro') === 'true' ? 'signin' : 'intro')
        })
        return
      }

      if (token && !displayId) {
        executeOrQueue(() => {
          sessionStorage.setItem('hasSeenSplash', 'true')
          setStep('signin')
        })
        return
      }

      if (!navigator.onLine) {
        setIsOffline(true)
        return
      }

      setIsOffline(false)

      try {
        const { getStoredScreenId, generateLayoutHash, syncDeviceAndScreens } = await import('@/services/DeviceSyncService')
        const monitors = await window.electronAPI.invoke('get-monitors')
        const baseUrl = 'https://tabrevolver.variabl.co'
        let playlists: any[] = []
        let fetchFailed = false
        try {
          playlists = await window.electronAPI.invoke('fetch-playlists', baseUrl, token)
        } catch (fetchErr: any) {
          console.error('[Onboarding] Error fetching playlists:', fetchErr)
          if (fetchErr.message && fetchErr.message.includes('401')) {
            const newToken = await useAuthStore.getState().refreshAuthToken()
            if (!newToken) {
              useAuthStore.getState().logout()
              executeOrQueue(() => {
                sessionStorage.setItem('hasSeenSplash', 'true')
                setStep('intro')
              })
              return
            }
            playlists = await window.electronAPI.invoke('fetch-playlists', baseUrl, newToken)
          } else {
            fetchFailed = true
          }
        }

        const storedAssignmentsStr = localStorage.getItem('monitorAssignments')
        const storedAssignments = storedAssignmentsStr ? JSON.parse(storedAssignmentsStr) : {}

        let hasAllAssignments = true
        let hasAnyAssignment = false
        const newAssignments: Record<number, any> = {}

        for (const monitor of monitors) {
          const screenId = getStoredScreenId(monitor.id.toString())
          if (!screenId) {
            hasAllAssignments = false
            continue
          }

          let playlistId: string | null = null
          try {
            const snapshot = await getDoc(doc(db, 'screens', screenId))
            playlistId = snapshot.data()?.nowPlayingPlaylistId
          } catch (dbErr) {
            console.error('[Onboarding] Error fetching screen from Firestore:', dbErr)
          }

          if (playlistId) {
            const fullPlaylist = playlists.find((p: any) => p.id === playlistId)
            if (fullPlaylist) {
              newAssignments[monitor.id] = fullPlaylist
              hasAnyAssignment = true
            } else if (storedAssignments[monitor.id]?.id === playlistId) {
              // Fallback to cached playlist if it matches the ID from Firestore
              newAssignments[monitor.id] = storedAssignments[monitor.id]
              hasAnyAssignment = true
            } else {
              newAssignments[monitor.id] = null
              hasAllAssignments = false
            }
          } else {
            // If Firestore doesn't have an ID, but we have a cached assignment and fetch failed,
            // or if we just want to aggressively resume, we can fallback to cached.
            // But if Firestore explicitly has NO ID (e.g. user cleared it remotely), we should respect it.
            // However, to fix the issue where it doesn't resume, we will use the cached assignment 
            // if we couldn't fetch from Firestore or if it was cleared incorrectly during update.
            if (storedAssignments[monitor.id]) {
               newAssignments[monitor.id] = storedAssignments[monitor.id]
               hasAnyAssignment = true
            } else {
               newAssignments[monitor.id] = null
               hasAllAssignments = false
            }
          }
        }

        // Always sync on startup so backend knows about any plugged/unplugged monitors
        syncDeviceAndScreens(monitors, newAssignments).catch(console.error)

        // Always auto-start based on assignments, completely bypassing the playlist picker
        executeOrQueue(() => {
          sessionStorage.setItem('hasSeenSplash', 'true')
          
          // Auto start logic
          localStorage.setItem('monitorAssignments', JSON.stringify(newAssignments))
          useAppStore.getState().setMonitorAssignments(newAssignments)
          
          window.electronAPI.invoke('start-secondary-players', newAssignments).catch(err => {
            console.error('Failed to start secondary players:', err)
          })

          const primaryMonitorId = monitors.find((m: any) => m.isPrimary)?.id
          if (primaryMonitorId) {
            useAppStore.getState().setSelectedMonitorId(primaryMonitorId)
            useAuthStore.getState().setDisplayId(primaryMonitorId.toString())
            if (newAssignments[primaryMonitorId]) {
              useAppStore.getState().setSelectedPlaylist(newAssignments[primaryMonitorId])
              navigate('player')
            } else {
              navigate('inactive')
            }
          } else {
            const firstAssigned = Object.values(newAssignments).find(p => p !== null && p !== undefined)
            if (firstAssigned) {
              useAppStore.getState().setSelectedPlaylist(firstAssigned)
              navigate('player')
            } else {
              navigate('inactive')
            }
          }
        })

      } catch (err) {
        console.error('[Onboarding] Fatal error in determineNextStep:', err)
        if (!navigator.onLine || err?.toString()?.includes('offline')) {
          setIsOffline(true)
        } else {
          executeOrQueue(() => {
            sessionStorage.setItem('hasSeenSplash', 'true')
            useAppStore.getState().navigate('inactive')
          })
        }
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

      {isOffline && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c3.66 0 6.99 1.4 9.5 3.71"/><path d="M14.08 8.44a6 6 0 0 1 5.08 2.32"/><path d="M1.08 9.08a10 10 0 0 1 5.56-3.52"/><path d="M2.99 14.49a6 6 0 0 1 6.84-4.81"/><path d="M4.58 19.58a2 2 0 0 1 2.89-2.82"/><path d="M22 22 2 2"/></svg>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">No internet connection</h2>
              <p className="text-slate-400 max-w-md">Variabl requires an active internet connection to load playlists and sync screen settings.</p>
            </div>
            <button
              onClick={checkNetworkAndProceed}
              className="mt-4 px-6 py-3 bg-white text-black font-medium rounded-xl hover:bg-slate-200 transition-colors active:scale-95 cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {!isOffline && step === 'splash' && <SplashStep onNext={handleSplashComplete} />}
      {!isOffline && step === 'intro' && <IntroStep onNext={() => {
        localStorage.setItem('hasSeenIntro', 'true')
        setStep('signin')
      }} onBack={handleBack} />}
      {!isOffline && step === 'signin' && (
        <SignInStep onNext={() => setStep('checking')} onBack={handleBack} />
      )}
      {step === 'checking' && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent z-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
        </div>
      )}
    </AuroraBackground>
  )
}

