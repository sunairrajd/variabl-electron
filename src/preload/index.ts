import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { EVENT_CHANNELS, INVOKE_CHANNELS, SEND_CHANNELS, type ElectronApi } from '../shared/ipc'

const isAllowed = (whitelist: readonly string[], channel: string): boolean =>
  whitelist.includes(channel)

const api: ElectronApi = {
  invoke(channel, ...args) {
    if (!isAllowed(INVOKE_CHANNELS, channel)) {
      throw new Error(`Blocked IPC invoke on unlisted channel: ${channel}`)
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  send(channel, ...args) {
    if (!isAllowed(SEND_CHANNELS, channel)) {
      throw new Error(`Blocked IPC send on unlisted channel: ${channel}`)
    }
    ipcRenderer.send(channel, ...args)
  },
  on(channel, callback) {
    if (!isAllowed(EVENT_CHANNELS, channel)) {
      throw new Error(`Blocked IPC listener on unlisted channel: ${channel}`)
    }
    const listener = (_event: IpcRendererEvent, ...args: unknown[]): void => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electronAPI', api)
} else {
  // contextIsolation is always enabled in this app; defensive fallback only.
  // @ts-expect-error window is untyped on the non-isolated path
  window.electronAPI = api
}
