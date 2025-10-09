import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

type AuthType = 'basic' | 'bearer'

type AuthState = {
  authType: AuthType | null
  authorizationHeader: string | null
  username: string | null
  setBasicCredentials: (username: string, password: string) => void
  setBearerToken: (token: string) => void
  clearAuth: () => void
}

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

const base64Encode = (value: string) => {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(value)
  }
  if (typeof btoa === 'function') {
    return btoa(value)
  }
  throw new Error('Base64 encoding is not supported in this environment')
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      authType: null,
      authorizationHeader: null,
      username: null,
      setBasicCredentials: (username: string, password: string) => {
        const token = base64Encode(`${username}:${password}`)
        set({
          authType: 'basic',
          authorizationHeader: `Basic ${token}`,
          username,
        })
      },
      setBearerToken: (token: string) => {
        set({
          authType: 'bearer',
          authorizationHeader: `Bearer ${token.trim()}`,
          username: null,
        })
      },
      clearAuth: () => set({ authType: null, authorizationHeader: null, username: null }),
    }),
    {
      name: 'graphiti-admin-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' && window.localStorage ? window.localStorage : noopStorage,
      ),
      version: 1,
    },
  ),
)

export const getAuthorizationHeader = () => useAuthStore.getState().authorizationHeader
