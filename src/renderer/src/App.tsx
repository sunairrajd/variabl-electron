import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import PairingScreen from '@/screens/PairingScreen'
import PlaylistPicker from '@/screens/PlaylistPicker'
import PlayerScreen from '@/screens/PlayerScreen'
import OnboardingScreen from '@/screens/OnboardingScreen'
import InactiveScreen from '@/screens/InactiveScreen'
import PlayerOverlayScreen from '@/screens/PlayerOverlayScreen'
import { rtdb, rtdbRef, rtdbUpdate } from '@/lib/firebase'

const SCREENS = {
  pairing: PairingScreen,
  picker: PlaylistPicker,
  player: PlayerScreen,
  onboarding: OnboardingScreen,
  inactive: InactiveScreen,
} as const

function App(): React.JSX.Element {
  const currentView = useAppStore((s) => s.currentView)
  const navigate = useAppStore((s) => s.navigate)
  const setDeviceToken = useAuthStore((s) => s.setDeviceToken)
  const displayId = useAuthStore((s) => s.displayId)

  // 3-minute heartbeat updating lastSeen in Firebase Realtime Database
  useEffect(() => {
    if (!displayId) return

    const sendHeartbeat = async () => {
      try {
        await rtdbUpdate(rtdbRef(rtdb, `screens/${displayId}`), {
          lastSeen: Date.now()
        })
        console.log('[Heartbeat] Sent active heartbeat update to RTDB')
      } catch (err) {
        console.error('[Heartbeat] Failed to send heartbeat to RTDB:', err)
      }
    }

    // Send immediate heartbeat on activation/startup
    sendHeartbeat()

    const interval = setInterval(sendHeartbeat, 180000)

    return () => clearInterval(interval)
  }, [displayId])

  // Auto-login: a stored deviceToken means the device was already paired.
  // Full custom-token re-auth lands in Task 6; here we only restore routing.
  useEffect(() => {
    window.electronAPI
      .invoke('store-get', 'deviceToken')
      .then((token) => {
        if (typeof token === 'string' && token.length > 0) {
          setDeviceToken(token)
          navigate('picker')
        }
      })
      .catch(() => {
        // No persisted token (or store IPC not yet wired) — stay on pairing.
      })
  }, [navigate, setDeviceToken])



  const Screen = SCREENS[currentView]
  return <Screen />
}

export default App
