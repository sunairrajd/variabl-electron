import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useAppStore } from '@/stores/useAppStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const DASHBOARD_PAIRING_URL = 'https://dashboard.tabrevolver.com/pair'
const PIN_LENGTH = 4

function PairingScreen(): React.JSX.Element {
  const navigate = useAppStore((s) => s.navigate)
  const [pin, setPin] = useState('')
  const [appVersion, setAppVersion] = useState('')
  // A throwaway device id for the QR deep link. Task 6 replaces this with the
  // persisted identity once the real pairing chain is wired up.
  const [deviceId] = useState(() => crypto.randomUUID())

  useEffect(() => {
    window.electronAPI
      .invoke('get-app-version')
      .then(setAppVersion)
      .catch(() => { })
  }, [])

  const pairingUrl = `${DASHBOARD_PAIRING_URL}?device=${deviceId}`
  const isPinComplete = pin.length === PIN_LENGTH

  // Mocked pairing handler — the PIN→deviceToken→custom-token chain lands in Task 6.
  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    if (!isPinComplete) return
    navigate('player')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-border bg-card p-10 shadow-xl">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Variabl
        </h1>

        <div className="rounded-xl bg-white p-4">
          <QRCodeSVG value={pairingUrl} size={196} level="M" />
        </div>
        <p className="text-sm text-muted-foreground">Scan to pair this display</p>

        <div className="flex w-full items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="flex w-full flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">
            Enter your PIN from the dashboard
          </p>
          <Input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0000"
            aria-label="Pairing PIN"
            className="h-14 text-center text-2xl tracking-[0.5em]"
          />
          <Button type="submit" size="lg" className="w-full" disabled={!isPinComplete}>
            Pair display
          </Button>
        </form>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        {appVersion ? `v${appVersion}` : ''}
      </p>
    </div>
  )
}

export default PairingScreen
