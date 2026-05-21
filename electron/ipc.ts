import { ipcMain, screen, BrowserWindow, BrowserView } from 'electron'

let webView: BrowserView | null = null

export function setupIpcHandlers() {
  ipcMain.handle('get-monitors', () => {
    return screen.getAllDisplays().map((display, index) => ({
      id: display.id,
      label: `Display ${index + 1}`,
      bounds: display.bounds,
      isPrimary: display.id === screen.getPrimaryDisplay().id
    }))
  })

  ipcMain.handle('set-primary-display', (event, displayId) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const display = screen.getAllDisplays().find(d => d.id === displayId)
    
    if (window && display) {
      window.setBounds(display.bounds)
      window.setFullScreen(true)
    }
  })

  ipcMain.handle('show-website', (event, { url }) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return

    if (!webView) {
      webView = new BrowserView()
      window.addBrowserView(webView)
    }

    // Set bounds to cover the window but maybe leave some UI visible if needed
    // For fullscreen kiosk, we cover the whole bounds
    const bounds = window.getBounds()
    webView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
    webView.webContents.loadURL(url)
  })

  ipcMain.handle('hide-website', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window && webView) {
      window.removeBrowserView(webView)
      webView = null
    }
  })
}
