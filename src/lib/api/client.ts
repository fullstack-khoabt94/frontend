import axios, { type AxiosError } from 'axios'
import { env } from '@/lib/env'
import { sessionStore } from '@/features/auth/session'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * Opt a request out of the 401 handler below. For callers that treat a
     * rejected token as a normal outcome and clear the session themselves — a
     * hard `window.location` redirect underneath them would only cost a second
     * full page load.
     */
    skipAuthRedirect?: boolean
  }
}

export const api = axios.create({
  baseURL: env.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
})

api.interceptors.request.use((config) => {
  const { accessToken } = sessionStore.getState()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

/** Endpoints where a 401 is a normal answer, not an expired session. */
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
]

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const url = error.config?.url ?? ''
    const isPublic = PUBLIC_PATHS.some((path) => url.startsWith(path))
    if (error.response?.status === 401 && !isPublic && !error.config?.skipAuthRedirect) {
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
export function getApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
) {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}
