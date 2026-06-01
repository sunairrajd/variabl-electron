import { create } from 'zustand'

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
  firebaseUser: AuthUser | null
  screenName: string | null
  displayId: string | null
  setDeviceToken: (token: string | null) => void
  setFirebaseUser: (user: AuthUser | null) => void
  setScreenData: (screenName: string, displayId: string) => void
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

export const useAuthStore = create<AuthState>((set) => ({
  deviceToken: getLocalStorageItem('deviceToken'),
  firebaseUser: null,
  screenName: getLocalStorageItem('screenName'),
  displayId: getLocalStorageItem('displayId'),
  setDeviceToken: (deviceToken) => {
    setLocalStorageItem('deviceToken', deviceToken)
    set({ deviceToken })
  },
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setScreenData: (screenName, displayId) => {
    setLocalStorageItem('screenName', screenName)
    setLocalStorageItem('displayId', displayId)
    set({ screenName, displayId })
  },
  logout: () => {
    setLocalStorageItem('deviceToken', null)
    setLocalStorageItem('screenName', null)
    setLocalStorageItem('displayId', null)
    set({ deviceToken: null, firebaseUser: null, screenName: null, displayId: null })
  }
}))

/** Derived: the device has completed Firebase sign-in. */
export const useIsAuthenticated = (): boolean =>
  useAuthStore((s) => s.firebaseUser !== null)
