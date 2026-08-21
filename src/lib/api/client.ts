import axios, { AxiosError } from 'axios'
import { env } from '@/lib/env'
import { sessionStore } from '@/features/auth/session'
import { mockAdapter } from './mock-adapter'

export const api = axios.create({
  baseURL: env.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
  // Swap-out point: drop `adapter` (or set VITE_USE_MOCK_API=false) and every
  // request below goes to the real backend unchanged.
  ...(env.useMockApi ? { adapter: mockAdapter } : {}),
})

api.interceptors.request.use((config) => {
  const { accessToken } = sessionStore.getState()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

/** Endpoints where a 401 is a normal answer, not an expired session. */
const PUBLIC_PATHS = ['/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/reset-password']

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const url = error.config?.url ?? ''
    const isPublic = PUBLIC_PATHS.some((path) => url.startsWith(path))
    if (error.response?.status === 401 && !isPublic) {
      sessionStore.clear()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
      }
    }
    return Promise.reject(error)
  },
)

export type ApiErrorBody = { message?: string; errors?: Record<string, string[]> }

/** Normalises anything thrown by axios into a message safe to show in a toast. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}
