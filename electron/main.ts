import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './windows.ts'
import { setupIpcHandlers } from './ipc.ts'

// Disable hardware acceleration for stability if needed
// app.disableHardwareAcceleration()

app.whenReady().then(() => {
  setupIpcHandlers()
  
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
