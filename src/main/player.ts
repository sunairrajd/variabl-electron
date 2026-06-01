import { BrowserWindow, globalShortcut } from 'electron'

export function stopPlayer() {
  globalShortcut.unregister('Escape')

  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (mainWindow) {
    if (mainWindow.isKiosk()) {
      mainWindow.setKiosk(false)
    }
  }
}
