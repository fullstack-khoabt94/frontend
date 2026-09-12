import axios, { type AxiosError } from 'axios'
import { env } from '@/lib/env'
import { refreshAccessToken } from '@/features/auth/refresh'
import { sessionStore } from '@/features/auth/session'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * Opt a request out of the redirect below. For callers that treat a rejected
     * token as a normal outcome and handle it themselves — a hard
     * `window.location` redirect underneath them would only cost a second full
     * page load. It does not opt out of the refresh attempt.
     */
    skipAuthRedirect?: boolean
    /** Set by the interceptor so one request can only be replayed once. */
    retriedAfterRefresh?: boolean
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

/**
 * Endpoints where a 401 is a normal answer, not an expired session.
 *
 * The two password-reset paths matter as much as login does: the backend raises
 * `BadCredentialsException` — a 401 — for an unrecognised email and for a spent
 * reset token alike. Off this list, either would clear the session and hard-
 * redirect a signed-out visitor to /login mid-form.
 */
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/refresh-token',
  '/auth/request-reset-password-token',
  '/auth/reset-password',
]

/**
 * The identity endpoint, and the one path where **any** 4xx ends the session.
 *
 * Everywhere else a non-401 client error is about the request — a bad payload, a
 * row that is not yours, a stale id — and says nothing about the token. Here
 * there is no request to get wrong: the call carries no body and no id, and the
 * backend reads the subject straight off the JWT. So any refusal at all is a
 * refusal of the token itself (`403` from a disabled or role-stripped account,
 * `404` once the row is gone, `400` on a principal it cannot resolve), and a
 * session whose own identity cannot be fetched has nothing left to authorise.
 */
const IDENTITY_PATH = '/user/me'

function redirectToLogin() {
  if (typeof window === 'undefined') return
  if (window.location.pathname.startsWith('/login')) return
  window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
}

/**
 * A 401 means the access token is gone or expired. Rather than ending the
 * session on the spot, spend the refresh token on a new one and replay the
 * request — the visitor never sees the 1h access-token boundary.
 *
 * On {@link IDENTITY_PATH} the net is wider: every 4xx ends the session, not
 * just 401. A 401 there still earns its refresh and replay first — an expired
 * access token is the ordinary case at boot — and only the answer that survives
 * that signs the visitor out.
 */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config
    const url = config?.url ?? ''
    const status = error.response?.status ?? 0
    const isPublic = PUBLIC_PATHS.some((path) => url.startsWith(path))
    if (isPublic || !config) return Promise.reject(error)

    const isClientError = status >= 400 && status < 500
    const endsSession = status === 401 || (isClientError && url.startsWith(IDENTITY_PATH))
    if (!endsSession) return Promise.reject(error)

    // Only the first 401 per request earns a refresh: a second one, already
    // carrying a token minted seconds ago, is a real refusal and replaying it
    // again would loop. A non-401 needs no refresh — the token was accepted and
    // the answer would not change with a newer one.
    if (status === 401 && !config.retriedAfterRefresh && sessionStore.getState().refreshToken) {
      const outcome = await refreshAccessToken()
      if (outcome.status === 'refreshed') {
        config.retriedAfterRefresh = true
        config.headers.Authorization = `Bearer ${outcome.accessToken}`
        return api.request(config)
      }
      // The exchange could not reach the API. That is not evidence the session
      // ended, so leave it alone and let the caller handle the failure.
      if (outcome.status === 'unavailable') return Promise.reject(error)
    }

    sessionStore.clear()
    if (!config.skipAuthRedirect) redirectToLogin()
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
