import { app, BrowserWindow, shell, session } from 'electron'
import { join, resolve } from 'path'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { autoUpdater } from 'electron-updater'

// Allow autoplay without user gesture — required for digital signage / kiosk mode.
// Must be set before app.whenReady().
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

app.setName('Variabl')

export function loadDashboard(targetWin?: BrowserWindow, searchParams: string = '') {
  const win = targetWin || BrowserWindow.getAllWindows()[0]
  if (!win) return

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${searchParams}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { search: searchParams })
  }
}

export function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 900,
    minHeight: 670,
    show: false,
    backgroundColor: '#ffffff',
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
    if (is.dev) {
      win.webContents.openDevTools({ mode: 'detach' })
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadDashboard(win)
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
      // Only spoof the top-level iframe/document requests. 
      // Spoofing internal XHR/fetch/ping requests breaks YouTube's internal CSRF/CORS.
      if (details.resourceType === 'subFrame' || details.resourceType === 'mainFrame') {
        details.requestHeaders['Referer'] = 'https://variabl.co/'
        details.requestHeaders['Origin'] = 'https://variabl.co'
      }
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
      
      let wasFullScreen = false
      if (mainWindow && mainWindow.isFullScreen()) {
        wasFullScreen = true
      }

      const createAuthWindow = () => {
        const authWindow = new BrowserWindow({
          width: 800,
          height: 650,
          alwaysOnTop: true,
          focusable: true,
          autoHideMenuBar: true,
          webPreferences: {
            session: contents.session // Use the SAME session partition as the webview
          }
        })

        authWindow.loadURL(url)

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('auth-window-state', true)
        }

        authWindow.on('closed', () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('auth-window-state', false)
            if (wasFullScreen) {
              mainWindow.setFullScreen(true)
            }
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
      }

      if (wasFullScreen && mainWindow) {
        mainWindow.once('leave-full-screen', () => {
          createAuthWindow()
        })
        mainWindow.setFullScreen(false)
      } else {
        createAuthWindow()
      }

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
      autoUpdater.quitAndInstall(true, true)
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
          win.webContents.send('update-ready', info.version)
        }
      })

      // Give users 2 minutes to manually restart if they are interacting, 
      // otherwise force restart to ensure kiosk stays updated.
      setTimeout(() => {
        autoUpdater.quitAndInstall(true, true)
      }, 2 * 60 * 1000)
    })

    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Checking for updates...')
    })

    autoUpdater.on('update-available', (info) => {
      console.log(`[AutoUpdater] Update available! New version: ${info.version}`)
    })

    autoUpdater.on('update-not-available', () => {
      console.log(`[AutoUpdater] App is up to date. Current version: ${app.getVersion()}`)
    })

    autoUpdater.on('error', (err) => {
      console.error('[AutoUpdater] Error during update:', err)
    })

    // Check immediately on startup
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[AutoUpdater] Initial update check failed:', err)
    })

    // Check again every 5 minutes
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.error('[AutoUpdater] Scheduled update check failed:', err)
      })
    }, 5 * 60 * 1000)
  }

  app.on('activate', () => {
    const mainWindow = BrowserWindow.getAllWindows().find((w) => !w.webContents.getURL().includes('monitorId='))
    if (!mainWindow) createWindow()
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
