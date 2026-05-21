import { create } from 'zustand'

interface AuthState {
  token: string | null
  login: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('auth_token'),
  login: (token) => {
    localStorage.setItem('auth_token', token)
    set({ token })
  },
  logout: () => {
    localStorage.removeItem('auth_token')
    set({ token: null })
  },
}))
