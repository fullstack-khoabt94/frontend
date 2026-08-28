import { useSyncExternalStore } from 'react'
import { deleteCookie, readCookie, writeCookie } from '@/lib/cookies'
import { storedSessionSchema, type AuthResponse, type User } from './schemas'

export type Session = {
  accessToken: string | null
  /** Exchanged for a new access token by `refresh.ts` once the access one dies. */
  refreshToken: string | null
  /**
   * Epoch milliseconds, **on this browser's clock**, past which the session can
   * no longer serve a request. `null` only for the signed-out session.
   */
  expiresAt: number | null
  user: User | null
}

const EMPTY: Session = { accessToken: null, refreshToken: null, expiresAt: null, user: null }

/** Only written when the visitor ticked "Keep me signed in". */
const COOKIE_NAME = 'taskflow_session'

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

/**
 * Turns a login or refresh response into a session whose deadline is expressed
 * on **this browser's** clock.
 *
 * The refresh token's deadline arrives as a zone-less `LocalDateTime`, so its
 * true instant is unknowable here: `Date.parse` reads a string with no offset as
 * browser-local time, which is exact when the server shares the visitor's
 * timezone and off by the difference when it does not.
 *
 * That is deliberately tolerated rather than corrected, because **this deadline
 * is only ever an optimisation**. The server is the authority on whether a token
 * still works — a stale one produces a 401, a refresh attempt, and a clean sign-
 * out. So reading it too generously costs one wasted round trip at boot, and the
 * `Math.max` below makes sure reading it too strictly can never shorten a session
 * below the access token's own lifetime. Both failure modes are bounded; neither
 * signs out a visitor whose tokens are live.
 *
 * The longer-lived token decides how long the session lasts. That is usually the
 * refresh token (24h vs 1h), but not always: a refresh mints a new access token
 * **without** extending the refresh token, so late in a long session the access
 * token is the one still standing.
 */
export function sessionFromAuthResponse(result: AuthResponse): Session {
  const now = Date.now()
  const refreshRemainingMs = Date.parse(result.refreshTokenExpiresIn) - now
  const lifetimeMs = Math.max(result.accessTokenExpiresIn * 1000, refreshRemainingMs)
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: now + lifetimeMs,
    user: result.user,
  }
}

function save(session: Session) {
  if (!session.accessToken || !session.user || session.expiresAt === null) return
  const remainingMs = session.expiresAt - Date.now()
  // A session that can no longer serve a request is not worth storing.
  if (remainingMs <= 0) return
  writeCookie(
    COOKIE_NAME,
    JSON.stringify({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      user: session.user,
    }),
    // `Max-Age` is a duration the browser counts down itself, so this survives a
    // clock that is wrong — and the cookie disappearing is the backstop for
    // `hydrate` never seeing a session that has outlived its tokens.
    { maxAge: remainingMs / 1000 },
  )
}

/** Re-writes the cookie only if there already is one — never creates it. */
function persistIfRemembered() {
  if (readCookie(COOKIE_NAME)) save(state)
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
 * in-memory token already is — and it now carries the longer-lived refresh
 * token too, which raises the stakes. The safe shape is an httpOnly cookie set
 * by the backend; until it sets one, this module is the only place that changes.
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
    persistIfRemembered()
    emit()
  },

  /**
   * Installs the tokens from a refresh exchange. It keeps the session's existing
   * persistence rather than taking a `remember` flag: whether this visitor asked
   * to be kept signed in was decided at login, and a refresh must not change it.
   */
  applyRefresh(next: Session) {
    state = next
    tokenIsUnverified = false
    persistIfRemembered()
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
   * What it restores is provisional — nothing here has asked the backend
   * anything, so the session is flagged unverified until `ensureSessionVerified()`
   * has confirmed it.
   *
   * An expired **access** token is not a reason to drop the session: that is
   * exactly what the refresh token is for, and the first request will exchange
   * it. Only a session past `expiresAt` — when neither token can serve — is
   * discarded, and the cookie's own `Max-Age` should already have done that.
   */
  hydrate() {
    const raw = readCookie(COOKIE_NAME)
    if (!raw) return
    try {
      // Not annotated as `Session`: the schema guarantees a non-null `expiresAt`,
      // and widening it back to `number | null` here would lose that.
      const restored = storedSessionSchema.parse(JSON.parse(raw))
      if (restored.expiresAt <= Date.now()) {
        deleteCookie(COOKIE_NAME)
        return
      }
      state = restored
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
