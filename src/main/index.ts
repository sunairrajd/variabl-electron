import { app, BrowserWindow, shell, session } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'

export function loadDashboard() {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hidden',
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

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadDashboard()
}

let pendingAuthUrl: string | null = null

app.setAsDefaultProtocolClient('tabrevolver')

// Handle deep links (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault()
  console.log('[Main] Received open-url:', url)
  pendingAuthUrl = url
  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    mainWindow.webContents.send('auth-url', url)
  }
})

app.whenReady().then(() => {
  // Global anti-embedding bypass for strict websites (Google, Amazon, etc.)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders }
    
    // Strip headers that prevent embedding
    for (const key of Object.keys(responseHeaders)) {
      const lowerKey = key.toLowerCase()
      if (lowerKey === 'x-frame-options' || lowerKey === 'content-security-policy') {
        delete responseHeaders[key]
      }
    }
    
    callback({ cancel: false, responseHeaders })
  })

  // Spoof User Agent to disguise Electron environment
  const currentUserAgent = session.defaultSession.getUserAgent()
  const cleanUserAgent = currentUserAgent
    .replace(/Electron\/[a-zA-Z0-9.-]+ /, '')
    .replace(/variabl electron app\/[a-zA-Z0-9.-]+ /, '')
  session.defaultSession.setUserAgent(cleanUserAgent)

  registerIpcHandlers(() => {
    const url = pendingAuthUrl
    pendingAuthUrl = null
    console.log('[Main] Consumed pending auth URL:', url)
    return url
  })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Handle deep links (Windows/Linux)
app.on('second-instance', (event, commandLine) => {
  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    
    // The url is usually the last argument
    const url = commandLine.pop()
    if (url) {
      console.log('[Main] Received second-instance URL:', url)
      pendingAuthUrl = url
      mainWindow.webContents.send('auth-url', url)
    }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
