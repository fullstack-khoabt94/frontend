import axios from 'axios'
import { authApi } from './api'
import { sessionStore } from './session'

let pending: Promise<void> | null = null

/**
 * Proves a cookie-restored token against `GET /user/me` before the route guards
 * act on it, at most once per page load.
 *
 * Decoding the JWT locally only proves it has not expired — it says nothing
 * about whether the backend still accepts it. The signing secret may have
 * rotated, the account may be gone, or the cookie may simply have been edited.
 * So the first navigation of a restored session asks the API, and a rejected
 * token is dropped (cookie included) before any protected page renders.
 *
 * Returns `undefined` rather than a resolved promise once there is nothing left
 * to check, so navigations after the first do not pay for a microtask.
 */
export function ensureSessionVerified(): Promise<void> | undefined {
  if (!sessionStore.isUnverified()) return
  pending ??= verify()
  return pending
}

async function verify() {
  try {
    // `skipAuthRedirect`: a 401 here is the expected answer for a stale token,
    // and the handling below is softer than the interceptor's full page reload.
    const user = await authApi.me({ skipAuthRedirect: true })
    // The cookie holds whoever the user was at login; this is the current row.
    sessionStore.setUser(user)
    sessionStore.markVerified()
  } catch (error) {
    if (isTokenRejected(error)) {
      // Signed out from here on: the `/_app` guard turns this into a redirect to
      // /login, keeping the attempted URL in `?redirect=`.
      sessionStore.clear()
      return
    }
    // The API is unreachable or broken, which says nothing about the token.
    // Keep the session and let the next navigation try again.
    pending = null
  }
}

function isTokenRejected(error: unknown) {
  if (!axios.isAxiosError(error)) return false
  const status = error.response?.status
  return status === 401 || status === 403
}
