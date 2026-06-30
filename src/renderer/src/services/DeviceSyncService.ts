// import { db, doc, setDoc } from '../lib/firebase'
import type { MonitorInfo } from '../../../shared/ipc'
import { useAuthStore } from '../stores/useAuthStore'

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`
}

export function getStoredDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId')
  if (!deviceId) {
    deviceId = generateId('dev')
    localStorage.setItem('deviceId', deviceId)
  }
  return deviceId
}

export function getStoredDeviceName(initialComputerName: string | null): string {
  let deviceName = localStorage.getItem('deviceName')
  if (!deviceName) {
    deviceName = initialComputerName || 'Variabl Player'
    localStorage.setItem('deviceName', deviceName)
  }
  return deviceName
}

export function getStoredScreenId(displayId: string): string {
  const key = `screenId_${displayId}`
  let screenId = localStorage.getItem(key)
  if (!screenId) {
    screenId = `scr_${Math.random().toString(36).substring(2, 11)}`
    localStorage.setItem(key, screenId)
  }
  return screenId
}

export function generateLayoutHash(monitors: MonitorInfo[]): string {
  const str = monitors.map(m => `${m.id}-${m.bounds.x}-${m.bounds.y}`).join('|')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16)
}

export async function syncDeviceAndScreens(monitors: MonitorInfo[], assignments: Record<number, any>) {
  try {
    console.log('Starting syncDeviceAndScreens...')
    const deviceId = getStoredDeviceId()

    console.log('Fetching system info via IPC...')
    const { computerName, os } = await window.electronAPI.invoke('get-system-info')

    console.log('Fetching app version via IPC...')
    const appVersion = await window.electronAPI.invoke('get-app-version')

    const deviceToken = useAuthStore.getState().deviceToken
    let userId: string | null = null

    // The app doesn't use Firebase Auth SDK signIn, so firebaseUser is null.
    // We decode the JWT token directly to get the userId just like SignInStep.tsx
    if (deviceToken) {
      try {
        const payload = JSON.parse(atob(deviceToken.split('.')[1]))
        userId = payload.uid || payload.user_id || null
      } catch (e) {
        console.warn('Could not decode token for userId in DeviceSyncService')
      }
    }

    const now = Date.now()
    const layoutHash = generateLayoutHash(monitors)
    const deviceName = getStoredDeviceName(computerName)

    const screensData = monitors.map((monitor, index) => {
      const screenId = getStoredScreenId(monitor.id.toString())
      const assignment = assignments[monitor.id]

      // Check if we already have a stored screenName in localStorage
      let existingScreenName = monitor.label
      try {
        const storedDevice = localStorage.getItem('variableDevice')
        if (storedDevice) {
          const parsed = JSON.parse(storedDevice)
          const matchedScreen = parsed.screens?.find((s: any) => s.displayId === monitor.id.toString())
          if (matchedScreen?.screenName) {
            existingScreenName = matchedScreen.screenName
          }
        }
      } catch (e) {
        console.error('Failed to parse variableDevice for screenName fallback:', e)
      }

      return {
        screenId,
        deviceId,
        screenName: existingScreenName,
        position: index + 1,
        displayId: monitor.id.toString(),
        width: monitor.bounds.width,
        height: monitor.bounds.height,
        x: monitor.bounds.x,
        y: monitor.bounds.y,
        monitorModel: monitor.label,
        monitorSerial: null,
        nowPlayingPlaylistId: assignment ? assignment.id : null,
        status: 'online',
        lastSeen: now,
        createdAt: now,
        updatedAt: now,
      }
    })

    const variableDevice = {
      deviceId,
      deviceName,
      computerName,
      os,
      layoutHash,
      displayCount: monitors.length,
      lastSeen: now,
      screens: screensData.map(s => ({
        screenId: s.screenId,
        screenName: s.screenName,
        displayId: s.displayId,
        width: s.width,
        height: s.height,
        x: s.x,
        y: s.y,
        monitorModel: s.monitorModel,
        nowPlayingPlaylistId: s.nowPlayingPlaylistId
      }))
    }

    // Save to localStorage
    localStorage.setItem('variableDevice', JSON.stringify(variableDevice))
    console.log('Saved to localStorage:', variableDevice)

    // Sync to Firebase using our new backend API via IPC
    const devicePayload = {
      deviceId,
      deviceToken,
      deviceName,
      computerName,
      os,
      appVersion,
      displayCount: monitors.length,
      screens: screensData.map(s => s.screenId),
      lastSeen: now,
      createdAt: now,
      updatedAt: now,
      ...(userId ? { userId } : {})
    }

    console.log('Sending sync request to backend API via IPC...')
    const baseUrl = 'https://tabrevolver.variabl.co'

    // We send empty string if deviceToken is missing, but backend requires a token.
    if (!deviceToken) {
      console.warn('No device token found, skipping Firebase sync.')
      return
    }

    try {
      await window.electronAPI.invoke('sync-device-screens', baseUrl, deviceToken, devicePayload, screensData)
      console.log('Successfully synced device and screens via backend API.')
    } catch (apiError: any) {
      if (apiError.message && apiError.message.includes('401')) {
        console.log('Token expired during sync, attempting refresh...')
        const newToken = await useAuthStore.getState().refreshAuthToken()
        if (newToken) {
          await window.electronAPI.invoke('sync-device-screens', baseUrl, newToken, { ...devicePayload, deviceToken: newToken }, screensData)
          console.log('Successfully synced device and screens via backend API after token refresh.')
        } else {
          useAuthStore.getState().logout()
          throw new Error('Session expired. Please sign in again.')
        }
      } else {
        throw apiError
      }
    }

  } catch (error: any) {
    console.error('Failed to sync device and screens:', error)
  }
}
