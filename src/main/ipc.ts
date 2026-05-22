import { ipcMain, screen } from 'electron'
import type { MonitorInfo } from '../shared/ipc'

function getMonitors(): MonitorInfo[] {
  const primaryId = screen.getPrimaryDisplay().id
  return screen.getAllDisplays().map((display) => ({
    id: display.id,
    label: display.label || `Display ${display.id}`,
    bounds: display.bounds,
    isPrimary: display.id === primaryId
  }))
}

/** Registers every renderer→main handler. Call once after `app.whenReady()`. */
export function registerIpcHandlers(): void {
  ipcMain.handle('get-monitors', () => getMonitors())
}
