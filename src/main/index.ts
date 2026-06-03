import { app, BrowserWindow, shell, session } from 'electron'
import { join, resolve } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { autoUpdater } from 'electron-updater'

app.setName('Variabl')

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
    icon: join(__dirname, '../../resources/icon.png'),
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

if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient('tabrevolver', process.execPath, [resolve(process.argv[1])])
} else {
  app.setAsDefaultProtocolClient('tabrevolver')
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

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

app.whenReady().then(async () => {
  if (process.argv.includes('--reset') || process.env.RESET_DATA === 'true') {
    console.log('[Main] Factory Reset requested. Wiping all app data...')
    await session.defaultSession.clearStorageData()
  }
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

  // Spoof Referer/Origin for YouTube embeds (fixes Error 153 in production file:// builds)
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://*.googlevideo.com/*', '*://*.youtube-nocookie.com/*'] },
    (details, callback) => {
      details.requestHeaders['Referer'] = 'https://variabl.co'
      details.requestHeaders['Origin'] = 'https://variabl.co'
      callback({ requestHeaders: details.requestHeaders })
    }
  )

  // Spoof User Agent to disguise Electron environment
  const currentUserAgent = session.defaultSession.getUserAgent()
  const cleanUserAgent = currentUserAgent
    .replace(/Electron\/[a-zA-Z0-9.-]+ /, '')
    .replace(/variabl electron app\/[a-zA-Z0-9.-]+ /, '')
  session.defaultSession.setUserAgent(cleanUserAgent)

  // Set macOS dock icon in development/runtime
  if (process.platform === 'darwin') {
    const iconPath = join(__dirname, '../../resources/icon.png')
    try {
      app.dock?.setIcon(iconPath)
    } catch (e) {
      console.error('Failed to set dock icon:', e)
    }
  }

  app.on('web-contents-created', (_, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      console.log('[Main] webview requested popup for URL:', url)
      const mainWindow = BrowserWindow.getAllWindows()[0]

      const authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        parent: mainWindow,
        alwaysOnTop: true,
        focusable: true,
        autoHideMenuBar: true,
        webPreferences: {
          session: contents.session // Use the SAME session partition as the webview
        }
      })

      authWindow.loadURL(url)

      if (mainWindow) {
        mainWindow.webContents.send('auth-window-state', true)
      }

      authWindow.on('closed', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('auth-window-state', false)
        }
      })

      authWindow.webContents.on('did-navigate', (_, navUrl) => {
        console.log('[Main] authWindow did-navigate to:', navUrl)
        if (navUrl.includes('mail.google.com') && !navUrl.includes('accounts.google.com')) {
          console.log('[Main] Closing auth window due to did-navigate matching mail.google.com')
          authWindow.close()
          contents.reload()
        }
      })

      return { action: 'deny' }
    })
  })

  registerIpcHandlers(() => {
    const url = pendingAuthUrl
    pendingAuthUrl = null
    console.log('[Main] Consumed pending auth URL:', url)
    return url
  })

  // Expose manual install-update
  import('electron').then(({ ipcMain }) => {
    ipcMain.handle('install-update', () => {
      console.log('[Main] Manual install-update triggered from renderer')
      autoUpdater.quitAndInstall(false, true)
    })
  })

  // Autostart on machine login (Windows/macOS)
  if (!is.dev) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: false, // You can set this to true if you want it to start silently in the background
    })
  }

  createWindow()

  // Setup auto-updater in production
  if (!is.dev) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[AutoUpdater] Update downloaded. Quitting and installing...', info.version)

      // Notify all open windows that an update is ready
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('update-downloaded', info.version)
        }
      })

      // Give users 10 minutes to manually restart if they are interacting, 
      // otherwise force restart to ensure kiosk stays updated.
      setTimeout(() => {
        autoUpdater.quitAndInstall(false, true)
      }, 1 * 60 * 1000)
    })

    autoUpdater.on('error', (err) => {
      console.error('[AutoUpdater] Error during update:', err)
    })

    // Check immediately on startup
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[AutoUpdater] Initial update check failed:', err)
    })

    // Check again every 15 minutes
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.error('[AutoUpdater] Scheduled update check failed:', err)
      })
    }, 15 * 60 * 1000)
  }

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
