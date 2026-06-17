import { app, ipcMain, screen } from 'electron'
import type { MonitorInfo } from '../shared/ipc'
import { stopPlayer, startSecondaryPlayers, stopSecondaryPlayers, markMonitorReady } from './player'

import os from 'os'

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
export function registerIpcHandlers(getPendingAuthUrl?: () => string | null): void {
  ipcMain.handle('get-monitors', () => getMonitors())
  ipcMain.handle('get-app-version', () => app.getVersion())
  ipcMain.handle('get-system-info', () => ({
    computerName: os.hostname(),
    os: `${os.type()} ${os.release()}`
  }))
  ipcMain.handle('open-external', (_, url: string) => {
    import('electron').then(({ shell }) => shell.openExternal(url))
  })
  
  ipcMain.handle('stop-player', () => {
    stopPlayer()
  })

  ipcMain.handle('start-secondary-players', (_, assignments: Record<number, any>) => {
    startSecondaryPlayers(assignments)
  })

  ipcMain.handle('close-secondary-players', () => {
    stopSecondaryPlayers()
  })

  ipcMain.handle('get-pending-auth-url', () => {
    return getPendingAuthUrl ? getPendingAuthUrl() : null
  })

  ipcMain.handle('toggle-kiosk', (_, enabled: boolean) => {
    import('electron').then(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        mainWindow.setFullScreen(enabled)
      }
    })
  })

  ipcMain.handle('store-get', () => {
    // Stub to prevent frontend errors
    return null
  })

  ipcMain.handle('fetch-playlists', async (_, baseUrl: string, token: string) => {
    // Always use production since the backend is not running locally
    const url = 'https://tabrevolver.variabl.co/api/playlists'
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch playlists: ${response.status} ${response.statusText}`)
    }
    return response.json()
  })

  ipcMain.handle('sync-playlist', async (_, baseUrl: string, token: string, playlistId: string, tabs: any[]) => {
    const url = `https://tabrevolver.variabl.co/api/playlists/${playlistId}`
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ tabs })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to sync playlist: ${response.status} ${response.statusText}`)
    }
    return response.json()
  })

  ipcMain.handle('sync-device-screens', async (_, baseUrl: string, token: string, devicePayload: any, screensData: any[]) => {
    // Always use production since the backend is not running locally
    const url = 'https://tabrevolver.variabl.co/api/devices/sync'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ devicePayload, screensData })
    })
    
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to sync device and screens: ${response.status} ${response.statusText} - ${text}`)
    }
    return response.json()
  })

  ipcMain.handle('fetch-custom-token', async (_, baseUrl: string, token: string) => {
    // Always use production since the backend is not running locally
    const url = 'https://tabrevolver.variabl.co/api/auth/custom-token'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to fetch custom token: ${response.status} ${response.statusText} - ${text}`)
    }
    return response.json()
  })

  ipcMain.handle('player-ready', (_, monitorId: number) => {
    markMonitorReady(monitorId)
  })
}
