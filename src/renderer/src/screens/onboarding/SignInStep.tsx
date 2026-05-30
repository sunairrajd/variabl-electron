import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'

interface SignInStepProps {
  onNext: () => void
  onBack: () => void
}

const DUMMY_PLAYLISTS = [
  { id: 1, name: 'Growth Initiatives', emoji: '🌱', edited: 'Edited 2 days ago' },
  { id: 2, name: 'Fire list', emoji: '🔥', edited: 'Edited 2 days ago' },
  { id: 3, name: 'Score card', emoji: '🏀', edited: 'Edited 2 days ago' },
  { id: 4, name: 'Fruits menu', emoji: '🍒', edited: 'Edited 2 days ago' },
  { id: 5, name: 'Launch plans', emoji: '🚀', edited: 'Edited 2 days ago' },
  { id: 6, name: 'Old docs', emoji: '🦖', edited: 'Edited 2 days ago' },
]

export default function SignInStep({ onNext, onBack }: SignInStepProps) {
  const setDeviceToken = useAuthStore((s) => s.setDeviceToken)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualToken, setManualToken] = useState('')

  const handleUrl = (url: unknown) => {
    if (typeof url === 'string') {
      try {
        // Handle full deep link tabrevolver://auth?token=... OR just a raw token string
        if (url.startsWith('tabrevolver://') || url.includes('token=')) {
          const parsedUrl = new URL(url.replace('tabrevolver://', 'https://'))
          const token = parsedUrl.searchParams.get('token')
          if (token) {
            console.log('[SignInStep] Successfully parsed token from auth URL')
            setDeviceToken(token)
            onNext()
            return
          }
        }
        
        // Treat as raw token
        if (url.trim().length > 20) {
          console.log('[SignInStep] Using manual input as raw token')
          setDeviceToken(url.trim())
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
    let cleanup = () => {}
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
    // Open variabl.co for the user login flow. 
    // The backend APIs will still be fetched from tabrevolver.variabl.co via IPC.
    const baseUrl = 'https://variabl.co'
    window.electronAPI.invoke('open-external', `${baseUrl}/login?desktop=true`)
  }

  return (
    <div className="relative flex flex-col items-center w-full h-full bg-gradient-to-b from-white to-[#e0f2fe] p-12">
      <button 
        onClick={onBack}
        className="absolute left-12 top-12 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <ArrowLeft className="h-5 w-5 text-slate-600" />
      </button>

      <div className="text-center max-w-md mt-8 mb-10">
        <h1 className="text-3xl font-medium text-slate-800 mb-3 leading-tight">
          Sign in to sync your preferences & playlists across devices
        </h1>
        <p className="text-sm text-slate-400">
          Import your Tab Revolver playlists and manage screens remotely.
        </p>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-auto w-full max-w-3xl">
        {DUMMY_PLAYLISTS.map((playlist) => (
          <div key={playlist.id} className="relative flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.06)] border border-slate-100">
            <button className="absolute right-3 top-3 text-slate-300 hover:text-slate-500">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <div className="text-3xl mb-2">{playlist.emoji}</div>
            <div className="text-sm font-medium text-slate-800">{playlist.name}</div>
            <div className="text-[10px] text-slate-400">{playlist.edited}</div>
          </div>
        ))}
      </div>
      
      <div className="mt-8 mb-4 flex flex-col items-center w-full">
        <Button 
          onClick={handleGoogleSignIn}
          className="rounded-full bg-[#2a2a2a] hover:bg-black text-white px-6 h-10 font-medium flex items-center gap-2 cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
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
          Sign-in with google
        </Button>

        {showManualInput ? (
          <div className="flex flex-col items-center gap-3 mt-6 w-full max-w-md p-4 bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-slate-100">
            <div className="text-xs text-slate-500 text-center">
              If the browser did not open the app automatically, copy the URL or the token from the browser's address bar and paste it below.
            </div>
            <input 
              type="text" 
              placeholder="Paste deep link (tabrevolver://auth?token=...) or token" 
              value={manualToken} 
              onChange={(e) => setManualToken(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2a2a2a] text-slate-800 placeholder-slate-400"
            />
            <div className="flex gap-2">
              <Button 
                onClick={() => handleUrl(manualToken)}
                className="rounded-full bg-slate-800 hover:bg-black text-white px-5 h-8 text-xs font-medium cursor-pointer"
              >
                Confirm and sign in
              </Button>
              <button 
                onClick={() => setShowManualInput(false)}
                className="text-xs text-slate-400 hover:text-slate-600 px-3"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowManualInput(true)} 
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors mt-4 underline underline-offset-4 cursor-pointer"
          >
            Trouble signing in? Paste token manually
          </button>
        )}
      </div>
    </div>
  )
}
