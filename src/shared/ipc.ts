/**
 * Single source of truth for IPC channels shared between the main and renderer
 * processes. The renderer only ever touches channels listed here, and the
 * preload script enforces the whitelist at runtime.
 */

export interface MonitorInfo {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  isPrimary: boolean
}

export interface SystemMemory {
  total: number
  free: number
}

/** Request args and response type for every renderer→main `invoke` channel. */
export interface IpcInvokeContract {
  'get-monitors': { args: []; result: MonitorInfo[] }
  'get-system-memory': { args: []; result: SystemMemory }
  'set-display': { args: [displayId: number]; result: void }
  'show-website': { args: [url: string]; result: void }
  'hide-website': { args: []; result: void }
  'store-get': { args: [key: string]; result: unknown }
  'store-set': { args: [key: string, value: unknown]; result: void }
  'app-restart': { args: []; result: void }
  'toggle-kiosk': { args: [enabled: boolean]; result: void }
}

export type InvokeChannel = keyof IpcInvokeContract
export type InvokeArgs<C extends InvokeChannel> = IpcInvokeContract[C]['args']
export type InvokeResult<C extends InvokeChannel> = IpcInvokeContract[C]['result']

/** Runtime whitelist mirroring {@link IpcInvokeContract}. */
export const INVOKE_CHANNELS = [
  'get-monitors',
  'get-system-memory',
  'set-display',
  'show-website',
  'hide-website',
  'store-get',
  'store-set',
  'app-restart',
  'toggle-kiosk'
] as const satisfies readonly InvokeChannel[]

/** Fire-and-forget renderer→main channels — populated in later tasks. */
export const SEND_CHANNELS: readonly string[] = []

/** Main→renderer push-event channels — populated in later tasks. */
export const EVENT_CHANNELS: readonly string[] = []

// Compile-time guard: every contract channel must appear in INVOKE_CHANNELS.
type UnlistedChannel = Exclude<InvokeChannel, (typeof INVOKE_CHANNELS)[number]>
const _whitelistIsComplete: [UnlistedChannel] extends [never] ? true : UnlistedChannel = true
void _whitelistIsComplete

export interface ElectronApi {
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): Promise<InvokeResult<C>>
  send(channel: string, ...args: unknown[]): void
  on(channel: string, callback: (...args: unknown[]) => void): () => void
}

declare global {
  interface Window {
    electronAPI: ElectronApi
  }
}
