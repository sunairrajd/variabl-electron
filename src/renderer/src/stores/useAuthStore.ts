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

export const useAuthStore = create<AuthState>((set) => ({
  deviceToken: null,
  firebaseUser: null,
  screenName: null,
  displayId: null,
  setDeviceToken: (deviceToken) => set({ deviceToken }),
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setScreenData: (screenName, displayId) => set({ screenName, displayId }),
  logout: () => set({ deviceToken: null, firebaseUser: null, screenName: null, displayId: null })
}))

/** Derived: the device has completed Firebase sign-in. */
export const useIsAuthenticated = (): boolean =>
  useAuthStore((s) => s.firebaseUser !== null)
