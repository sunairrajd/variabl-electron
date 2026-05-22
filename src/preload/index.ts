import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronAPI)
} else {
  // @ts-expect-error fallback for non-isolated context in tests
  window.electron = electronAPI
}
