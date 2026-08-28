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
 * So the first navigation of a restored session asks the API before any
 * protected page renders.
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
    // `skipAuthRedirect`: a 401 here is an expected answer, and letting the
    // interceptor navigate would cost a second full page load during boot. The
    // refresh-and-retry it does underneath this call still applies, so an
    // expired access token is renewed rather than ending the session.
    const user = await authApi.me({ skipAuthRedirect: true })
    // The cookie holds whoever the user was at login; this is the current row.
    sessionStore.setUser(user)
    sessionStore.markVerified()
  } catch {
    // No verdict is reached here on purpose. The interceptor is the single place
    // that decides what a 401 means, and it has already refreshed, retried, and
    // cleared the session if the tokens are genuinely spent. Reading the status
    // again here would get it wrong in one real case: when the original request
    // 401s and the *refresh* then fails on the network, the error that surfaces
    // is still that 401 — so this would sign out a visitor whose session the
    // interceptor deliberately kept.
    //
    // If the session survived, it is still unverified: drop the memoised promise
    // so the next navigation retries.
    pending = null
  }
}
