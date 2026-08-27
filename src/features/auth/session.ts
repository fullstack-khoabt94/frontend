import { useSyncExternalStore } from 'react'
import { deleteCookie, readCookie, writeCookie } from '@/lib/cookies'
import { authResponseSchema, type User } from './schemas'

export type Session = {
  accessToken: string | null
  user: User | null
}

const EMPTY: Session = { accessToken: null, user: null }

/** Only written when the visitor ticked "Keep me signed in". */
const COOKIE_NAME = 'taskflow_session'

/**
 * Ceiling on the cookie's lifetime. The access token is short-lived (1h by
 * default) and there is no refresh exchange, so the real limit is almost always
 * the token's own `exp`; this only caps the fallback when `exp` is unreadable.
 */
const MAX_REMEMBER_SECONDS = 30 * 24 * 60 * 60

let state: Session = EMPTY

/**
 * A token restored from the cookie is only a claim: it was valid when it was
 * written, and the backend may have rotated its signing secret or deleted the
 * account since. `verify-session.ts` clears this by asking the API.
 */
let tokenIsUnverified = false

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** `exp` of a JWT in epoch seconds, or `null` when it cannot be read. */
function readTokenExpiry(token: string): number | null {
  const segment = token.split('.')[1]
  if (!segment) return null
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const payload: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
    if (typeof payload !== 'object' || payload === null) return null
    const exp = (payload as { exp?: unknown }).exp
    return typeof exp === 'number' ? exp : null
  } catch {
    return null
  }
}

/**
 * Seconds the token is still good for. `null` means "unknown" — the cookie then
 * falls back to {@link MAX_REMEMBER_SECONDS} and the 401 interceptor is what
 * eventually clears it.
 */
function secondsUntilExpiry(token: string): number | null {
  const exp = readTokenExpiry(token)
  return exp === null ? null : exp - Math.floor(Date.now() / 1000)
}

function save(session: Session) {
  if (!session.accessToken || !session.user) return
  const remaining = secondsUntilExpiry(session.accessToken)
  // An already-expired token is not worth a round trip on the next reload.
  if (remaining !== null && remaining <= 0) return
  writeCookie(
    COOKIE_NAME,
    JSON.stringify({ accessToken: session.accessToken, user: session.user }),
    { maxAge: Math.min(remaining ?? MAX_REMEMBER_SECONDS, MAX_REMEMBER_SECONDS) },
  )
}

/**
 * Single source of truth for "who is signed in".
 *
 * It is a plain external store (not React context) on purpose: the axios
 * interceptor and the TanStack Router `beforeLoad` guards both need to read the
 * token outside of React's render cycle.
 *
 * The session lives in memory, and is mirrored into a cookie **only** when the
 * visitor asks to be kept signed in — see {@link set}. Without that tick a
 * reload signs them out, exactly as before.
 *
 * The cookie is readable by JavaScript, so it is XSS-exposed the same way the
 * in-memory token already is. The safe shape is an httpOnly cookie plus a
 * refresh-token exchange, which the backend does not offer yet; when it does,
 * `hydrate` and `save` are the only two places that change.
 */
export const sessionStore = {
  getState: () => state,
  isAuthenticated: () => Boolean(state.accessToken),

  /**
   * @param remember mirror the session into a cookie so it survives a reload.
   *   Defaults to `false`, which also clears any cookie left by an earlier
   *   remembered session — signing in without the tick must not inherit it.
   */
  set(next: Session, remember = false) {
    state = next
    // This token came straight from the API, so there is nothing to prove.
    tokenIsUnverified = false
    if (remember) save(next)
    else deleteCookie(COOKIE_NAME)
    emit()
  },

  setUser(user: User) {
    state = { ...state, user }
    // Keep the cookie in step, but never create one that was not asked for.
    if (readCookie(COOKIE_NAME)) save(state)
    emit()
  },

  clear() {
    state = EMPTY
    tokenIsUnverified = false
    deleteCookie(COOKIE_NAME)
    emit()
  },

  /** True while a cookie-restored token has not been proven against the API. */
  isUnverified: () => tokenIsUnverified,

  markVerified() {
    tokenIsUnverified = false
  },

  /**
   * Restores a remembered session. Called once before the router mounts, so the
   * `beforeLoad` guards see the token on the very first navigation instead of
   * bouncing the visitor to /login and back.
   *
   * What it restores is provisional — the expiry check here is local, so the
   * session is flagged unverified until `ensureSessionVerified()` has had the
   * backend confirm the token.
   */
  hydrate() {
    const raw = readCookie(COOKIE_NAME)
    if (!raw) return
    try {
      const { accessToken, user } = authResponseSchema.parse(JSON.parse(raw))
      const remaining = secondsUntilExpiry(accessToken)
      if (remaining !== null && remaining <= 0) {
        deleteCookie(COOKIE_NAME)
        return
      }
      state = { accessToken, user }
      tokenIsUnverified = true
      emit()
    } catch {
      // Tampered with, truncated, or written by an older schema.
      deleteCookie(COOKIE_NAME)
    }
  },

  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function useSession() {
  return useSyncExternalStore(
    (listener) => sessionStore.subscribe(listener),
    () => sessionStore.getState(),
    () => EMPTY,
  )
}
