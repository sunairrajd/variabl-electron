import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { db, doc, setDoc } from '@/lib/firebase'
import playlistsImage from '../../assets/playlists.png'
import { trackEvent } from '@/lib/analytics'

interface SignInStepProps {
  onNext: () => void
  onBack: () => void
}

export default function SignInStep({ onNext, onBack }: SignInStepProps) {
  const setDeviceToken = useAuthStore((s) => s.setDeviceToken)
  const setRefreshToken = useAuthStore((s) => s.setRefreshToken)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false)

  const handleUrl = async (url: unknown) => {
    if (typeof url === 'string') {
      try {
        let tokenToUse = ''
        let refreshTokenToUse = ''
        // Handle full deep link tabrevolver://auth?token=... OR just a raw token string
        if (url.startsWith('tabrevolver://') || url.includes('token=')) {
          const cleanUrl = typeof url === 'string' ? url.replace(/\/$/, '') : url
          const parsedUrl = new URL(cleanUrl.replace('tabrevolver://', 'https://'))
          const token = parsedUrl.searchParams.get('token')
          const refreshToken = parsedUrl.searchParams.get('refreshToken')
          if (token) {
            tokenToUse = token.replace(/\/$/, '')
          }
          if (refreshToken) {
            refreshTokenToUse = refreshToken.replace(/\/$/, '')
          }
        } else if (url.trim().length > 20) {
          tokenToUse = url.trim()
        }
        if (tokenToUse) {
          setDeviceToken(tokenToUse)
          if (refreshTokenToUse) {
            setRefreshToken(refreshTokenToUse)
          }

          // Sign into Firebase Auth using the custom token endpoint
          await useAuthStore.getState().signInToFirebase(tokenToUse)

          trackEvent('login_success', { method: url.startsWith('tabrevolver://') ? 'deep_link' : 'manual_paste' })

          // Try to register the screen in Firebase Realtime Database
          try {
            let { screenName, displayId } = useAuthStore.getState()

            // Auto-assign default screen name if not set (NameStep was skipped)
            if (!screenName || !displayId) {
              try {
                const monitors = await window.electronAPI.invoke('get-monitors')
                const primaryMonitor = monitors.find((m: any) => m.isPrimary) || monitors[0]
                screenName = primaryMonitor?.label || 'This screen'
                displayId = primaryMonitor?.id?.toString() || crypto.randomUUID()
              } catch (err) {
                console.warn('Failed to get monitors for sign in, using defaults')
                screenName = 'This screen'
                displayId = crypto.randomUUID()
              }
              useAuthStore.getState().setScreenData(screenName, displayId)
            }

            if (screenName && displayId) {
              let userId = ''
              try {
                // Attempt to decode JWT to get uid/user_id
                const payload = JSON.parse(atob(tokenToUse.split('.')[1]))
                userId = payload.uid || payload.user_id || ''
              } catch (e) {
                console.warn('Could not decode token for userId')
              }

              const now = Date.now()
              const { getStoredScreenId } = await import('@/services/DeviceSyncService')
              const screenId = getStoredScreenId(displayId)

              // We're moving away from RTDB completely for screen management
              const screenData = {
                createdAt: now,
                displayId: displayId,
                screenId: screenId,
                lastSeen: now,
                nowPlayingPlaylistId: "",
                screenName: screenName,
                updatedAt: now
              }

              // Write to Firestore directly
              await setDoc(doc(db, 'screens', screenId), screenData, { merge: true })
              console.log('[SignInStep] Successfully registered screen in Firestore')
            }
          } catch (err) {
            console.error('[SignInStep] Failed to save screen to Database:', err)
          }

          onNext()
        }
      } catch (err) {
        console.error('Failed to parse auth url:', err)
      }
    }
  }

  useEffect(() => {
    // Check for a pending auth URL that was captured during startup/before mount
    window.electronAPI.invoke('get-pending-auth-url')
      .then((pendingUrl) => {
        if (pendingUrl) {
          console.log('[SignInStep] Found pending auth URL on mount:', pendingUrl)
          handleUrl(pendingUrl)
        }
      })
      .catch((err) => {
        console.error('Failed to get pending auth url:', err)
      })

    // Listen for the custom protocol callback from the main process dynamically
    let cleanup = () => { }
    try {
      cleanup = window.electronAPI.on('auth-url', (url: unknown) => {
        console.log('[SignInStep] Received auth-url push event:', url)
        handleUrl(url)
      })
    } catch (err) {
      console.error('Failed to register auth-url listener:', err)
    }
    return cleanup
  }, [onNext, setDeviceToken])

  const handleGoogleSignIn = () => {
    if (isGoogleSigningIn) return;
    setIsGoogleSigningIn(true);
    trackEvent('click_google_sign_in')

    // Open variabl.co for the user login flow. 
    // The backend APIs will still be fetched from tabrevolver.variabl.co via IPC.
    const baseUrl = 'https://variabl.co'
    window.electronAPI.invoke('open-external', `${baseUrl}/login?desktop=true`)
  }

  return (
    <div className="flex flex-col justify-between items-center w-full h-full p-[3vw] opacity-0 animate-screen-enter">
      {/* Pinned Header Spacer & Title Area */}
      <div className="w-full flex flex-col items-center">
        <div className="w-full flex items-center justify-between">
          <div className="h-[clamp(2.5rem,3.2vw,4.5rem)] w-[clamp(2.5rem,3.2vw,4.5rem)] opacity-0" />
          <div className="h-[clamp(2.5rem,3.2vw,4.5rem)]" />
        </div>

        <div className="text-center max-w-[45vw] min-w-[320px] mt-[1vw]">
          <h1 className="text-[clamp(1.2rem,2vw,2.8rem)] font-light text-slate-700 mb-[1vw] tracking-[-1px] leading-[1.1]">
            Sign in to sync your preferences & playlists
          </h1>
          <p className="text-[clamp(0.75rem,0.9vw,1.2rem)] font-normal text-slate-400">
            Import your Variabl playlists and manage screens remotely.
          </p>
        </div>
      </div>

      {/* Centered Content (Only Playlists Showcase) */}
      <div className="flex flex-col items-center justify-center flex-1 my-[2vw]">
        <div className="p-[1vw] rounded-[1.5vw]  h-auto  flex justify-center items-center">
          <img
            src={playlistsImage}
            alt="Playlists Showcase"
            className="w-[65vw] max-w-[800px] min-w-[250px] max-h-[50vh] h-auto rounded-[1vw] object-contain"
          />
        </div>
      </div>



      {/* Pinned Footer with button & manual toggle */}
      <div className="w-full flex flex-col justify-center items-center gap-[1vw]">
        {!showManualInput ? (
          isGoogleSigningIn ? (
            <div className="flex flex-col items-center gap-2 mt-[1vw] animate-in fade-in zoom-in duration-300">
              <p className="text-[clamp(0.85rem,1vw,1.1rem)] font-medium text-slate-700">
                Go to the browser to complete login
              </p>
              <p className="text-[clamp(0.7rem,0.8vw,0.95rem)] text-slate-400">
                Not seeing the browser tab?{' '}
                <button
                  onClick={() => setIsGoogleSigningIn(false)}
                  className="text-slate-500 hover:text-slate-800 underline underline-offset-4 transition-colors font-medium cursor-pointer focus:ring-2 focus:ring-slate-400 focus:outline-none rounded px-1"
                >
                  Go back and try again
                </button>
              </p>
            </div>
          ) : (
            <Button
              onClick={handleGoogleSignIn}
              className="rounded-xl bg-[#2a2a2a] hover:bg-black text-white px-[4vw] w-full max-w-[280px] 4k:max-w-[400px] h-[clamp(2.5rem,3.2vw,4.5rem)] text-[clamp(0.8rem,0.95vw,1.25rem)] font-medium transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] hover:shadow-lg hover:shadow-black/5 flex items-center justify-center gap-2 animate-cta-enter cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="h-[clamp(1rem,1.2vw,1.6rem)] w-[clamp(1rem,1.2vw,1.6rem)]" fill="currentColor">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>
          )
        ) : (
          <div className="flex flex-col items-center gap-[0.8vw] w-full max-w-[320px] 4k:max-w-[440px] p-[1.2vw] bg-white/80 border border-black/5 rounded-2xl shadow-sm">
            <div className="text-[clamp(0.65rem,0.75vw,1rem)] text-slate-400 text-center leading-normal">
              If the browser did not open the app automatically, copy the URL or the token and paste it below.
            </div>
            <input
              type="text"
              placeholder="Paste deep link or token"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              className="w-full px-[1vw] py-[0.5vw] border border-black/5 rounded-xl text-[clamp(0.75rem,0.85vw,1.1rem)] bg-white/50 focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-700 placeholder-slate-300 font-light text-center"
            />
            <div className="flex gap-[0.6vw]">
              <Button
                onClick={() => handleUrl(manualToken)}
                className="rounded-lg bg-slate-800 hover:bg-black text-white px-[1.5vw] h-[clamp(1.8rem,2.2vw,3rem)] text-[clamp(0.7rem,0.8vw,1.1rem)] font-medium cursor-pointer"
              >
                Confirm
              </Button>
              <button
                onClick={() => setShowManualInput(false)}
                className="text-[clamp(0.7rem,0.8vw,1.1rem)] text-slate-400 hover:text-slate-600 px-[0.8vw] focus:ring-2 focus:ring-slate-400 focus:outline-none rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
