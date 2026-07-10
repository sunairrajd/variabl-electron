import { create } from 'zustand'
import { firebaseConfig, auth, signInWithCustomToken } from '@/lib/firebase'

/**
 * Minimal shape of the Firebase Auth user the app depends on. Firebase's full
 * `User` (wired up in Task 7) is structurally assignable to this.
 */
export interface AuthUser {
  uid: string
  email: string | null
}

interface AuthState {
  deviceToken: string | null
  refreshToken: string | null
  firebaseUser: AuthUser | null
  screenName: string | null
  displayId: string | null
  setDeviceToken: (token: string | null) => void
  setRefreshToken: (token: string | null) => void
  setDisplayId: (displayId: string | null) => void
  setFirebaseUser: (user: AuthUser | null) => void
  setScreenData: (screenName: string, displayId: string) => void
  refreshAuthToken: () => Promise<string | null>
  signInToFirebase: (idToken: string) => Promise<void>
  logout: () => void
}

const getLocalStorageItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    return null
  }
}

const setLocalStorageItem = (key: string, value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch (e) {
    // ignore
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  deviceToken: getLocalStorageItem('deviceToken'),
  refreshToken: getLocalStorageItem('refreshToken'),
  firebaseUser: null,
  screenName: getLocalStorageItem('screenName'),
  displayId: getLocalStorageItem('displayId'),
  setDeviceToken: (deviceToken) => {
    setLocalStorageItem('deviceToken', deviceToken)
    set({ deviceToken })
  },
  setRefreshToken: (token) => {
    setLocalStorageItem('refreshToken', token)
    set({ refreshToken: token })
  },
  setDisplayId: (displayId) => {
    setLocalStorageItem('displayId', displayId)
    set({ displayId })
  },
  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setScreenData: (screenName, displayId) => {
    setLocalStorageItem('screenName', screenName)
    setLocalStorageItem('displayId', displayId)
    set({ screenName, displayId })
  },
  logout: () => {
    setLocalStorageItem('deviceToken', null)
    setLocalStorageItem('refreshToken', null)
    setLocalStorageItem('monitorAssignments', null)
    if (auth) {
      auth.signOut().catch(console.error)
    }
    set({ deviceToken: null, refreshToken: null, firebaseUser: null })
  },
  refreshAuthToken: async () => {
    const { refreshToken } = get()
    if (!refreshToken) return null
    try {
      const apiKey = firebaseConfig.apiKey
      const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${refreshToken}`
      })
      if (!res.ok) throw new Error('Refresh failed')
      const data = await res.json()
      if (data.id_token) {
        setLocalStorageItem('deviceToken', data.id_token)
        if (data.refresh_token) {
          setLocalStorageItem('refreshToken', data.refresh_token)
          set({ deviceToken: data.id_token, refreshToken: data.refresh_token })
        } else {
          set({ deviceToken: data.id_token })
        }
        return data.id_token
      }
    } catch (err) {
      console.error('Failed to refresh token:', err)
      get().logout()
    }
    return null
  },
  signInToFirebase: async (idToken: string) => {
    try {
      // 1. Exchange the ID token for a custom token via our backend endpoint
      const response = await window.electronAPI.invoke('fetch-custom-token', 'https://tabrevolver.variabl.co', idToken)

      if (!response || !response.customToken) {
        throw new Error('No custom token returned')
      }

      // 2. Sign into Firebase using the custom token
      const userCredential = await signInWithCustomToken(auth, response.customToken)

      // 3. Update the store with the Firebase user
      set({
        firebaseUser: {
          uid: userCredential.user.uid,
          email: userCredential.user.email
        }
      })
      console.log('Successfully signed into Firebase Auth!')
    } catch (err) {
      console.error('Failed to sign in to Firebase with custom token:', err)
    }
  }
}))

/** Derived: the device has completed Firebase sign-in. */
export const useIsAuthenticated = (): boolean =>
  useAuthStore((s) => s.firebaseUser !== null)
