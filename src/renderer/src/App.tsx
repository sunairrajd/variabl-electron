import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useAuthStore } from '@/stores/useAuthStore'
import PairingScreen from '@/screens/PairingScreen'
import PlaylistPicker from '@/screens/PlaylistPicker'
import PlayerScreen from '@/screens/PlayerScreen'

const SCREENS = {
  pairing: PairingScreen,
  picker: PlaylistPicker,
  player: PlayerScreen
} as const

function App(): React.JSX.Element {
  const currentView = useAppStore((s) => s.currentView)
  const navigate = useAppStore((s) => s.navigate)
  const setDeviceToken = useAuthStore((s) => s.setDeviceToken)

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
