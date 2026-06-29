import { BrowserWindow, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { loadDashboard } from './index'

let secondaryWindows: BrowserWindow[] = []

export function startSecondaryPlayers(assignments: Record<number, any>) {
  const displays = screen.getAllDisplays()
  const primaryDisplayId = screen.getPrimaryDisplay().id

  // Determine expected monitors that have active playlists
  const expected: number[] = []
  if (assignments[primaryDisplayId]) {
    expected.push(primaryDisplayId)
  }

  Object.entries(assignments).forEach(([monitorIdStr, playlist]) => {
    const monitorId = parseInt(monitorIdStr, 10)
    if (monitorId !== primaryDisplayId && playlist) {
      expected.push(monitorId)
    }
  })
  setExpectedMonitors(expected)

  Object.entries(assignments).forEach(([monitorIdStr, playlist]) => {
    const monitorId = parseInt(monitorIdStr, 10)
    
    // Skip if it's the primary monitor
    if (monitorId === primaryDisplayId) {
      return
    }

    const display = displays.find((d) => d.id === monitorId)
    if (!display) return

    // Check if a window already exists for this monitor
    const existingWin = secondaryWindows.find(w => !w.isDestroyed() && w.webContents.getURL().includes(`monitorId=${monitorId}`))
    if (existingWin) {
      if (!existingWin.isVisible()) {
        existingWin.show()
      }
      return
    }

    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      fullscreen: true,
      frame: false,
      show: false,
      backgroundColor: '#ffffff',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        webviewTag: true
      }
    })

    win.on('ready-to-show', () => {
      win.show()
    })

    win.on('closed', () => {
      secondaryWindows = secondaryWindows.filter((w) => w !== win)
      // Send event to primary window ONLY if we are not in the middle of app quit
      const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().includes('monitorId='))
      if (mainWindow && !mainWindow.isDestroyed()) {
        import('./index').then(({ getIsQuitting }) => {
          if (!getIsQuitting()) {
            mainWindow.webContents.send('monitor-closed', monitorId)
          }
        })
      }
    })

    // Load the dashboard with a search param targeting this monitor
    loadDashboard(win, `?monitorId=${monitorId}`)
    
    secondaryWindows.push(win)
  })
}

export function stopSecondaryPlayers() {
  secondaryWindows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.close()
    }
  })
  secondaryWindows = []
}

export function stopPlayer() {
  globalShortcut.unregister('Escape')

  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (mainWindow) {
    // Keep window in full screen or revert depending on app logic
  }

  stopSecondaryPlayers()
}

let expectedMonitors = new Set<number>()
let readyMonitors = new Set<number>()
let readyTimeout: NodeJS.Timeout | null = null

export function setExpectedMonitors(monitorIds: number[]) {
  expectedMonitors = new Set(monitorIds)
  readyMonitors.clear()
  console.log('[PlayerSync] Expected monitors set to:', Array.from(expectedMonitors))

  if (readyTimeout) clearTimeout(readyTimeout)
  if (monitorIds.length > 1) {
    readyTimeout = setTimeout(() => {
      console.log('[PlayerSync] Synchronization timeout reached. Force starting countdowns.')
      broadcastToAll('start-countdown')
      expectedMonitors.clear()
      readyMonitors.clear()
    }, 6000)
  }
}

export function broadcastToAll(channel: string, ...args: any[]) {
  const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().includes('monitorId='))
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args)
  }
  secondaryWindows.forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  })
}

export function markMonitorReady(monitorId: number) {
  console.log(`[PlayerSync] Monitor ${monitorId} reported ready`)
  
  if (!expectedMonitors.has(monitorId)) {
    console.log(`[PlayerSync] Monitor ${monitorId} not in expected set. Starting immediately.`)
    const win = getWindowByMonitorId(monitorId)
    if (win && !win.isDestroyed()) {
      win.webContents.send('start-countdown')
    }
    return
  }
  
  readyMonitors.add(monitorId)
  
  let allReady = true
  for (const id of expectedMonitors) {
    if (!readyMonitors.has(id)) {
      allReady = false
      break
    }
  }
  
  if (allReady) {
    console.log('[PlayerSync] All expected monitors ready! Broadcasting start-countdown to all.')
    if (readyTimeout) clearTimeout(readyTimeout)
    broadcastToAll('start-countdown')
    expectedMonitors.clear()
    readyMonitors.clear()
  }
}

function getWindowByMonitorId(monitorId: number): BrowserWindow | undefined {
  const primaryDisplayId = screen.getPrimaryDisplay().id
  if (monitorId === primaryDisplayId) {
    return BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().includes('monitorId='))
  }
  return secondaryWindows.find(w => !w.isDestroyed() && w.webContents.getURL().includes(`monitorId=${monitorId}`))
}
