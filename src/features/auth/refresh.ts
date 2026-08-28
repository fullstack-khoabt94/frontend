import axios from 'axios'
import { env } from '@/lib/env'
import { authResponseSchema } from './schemas'
import { sessionFromAuthResponse, sessionStore } from './session'

export type RefreshOutcome =
  /** A new access token is in the store; the caller may retry. */
  | { status: 'refreshed'; accessToken: string }
  /** The refresh token is spent. The session has been cleared. */
  | { status: 'rejected' }
  /** The API could not be reached. The session is untouched — try again later. */
  | { status: 'unavailable' }

let inFlight: Promise<RefreshOutcome> | null = null

/**
 * Trades the refresh token for a fresh access token.
 *
 * **Single-flight.** A page typically fires several requests at once, so an
 * expired access token produces a burst of 401s; without this every one of them
 * would start its own exchange, and with rotation enabled on the backend all but
 * the first would be racing against an already-consumed token.
 */
export function refreshAccessToken(): Promise<RefreshOutcome> {
  inFlight ??= exchange().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function exchange(): Promise<RefreshOutcome> {
  const { refreshToken } = sessionStore.getState()
  if (!refreshToken) {
    sessionStore.clear()
    return { status: 'rejected' }
  }

  try {
    // Deliberately bare axios rather than the shared `api` instance: the
    // interceptor that calls this lives on `api`, so routing the exchange back
    // through it would recurse the moment the refresh itself answers 401.
    const { data } = await axios.post(
      `${env.apiBaseUrl}/auth/refresh-token`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 20_000 },
    )
    const next = authResponseSchema.parse(data)
    sessionStore.applyRefresh(sessionFromAuthResponse(next))
    return { status: 'refreshed', accessToken: next.accessToken }
  } catch (error) {
    // No response at all means the network or the server is down, which says
    // nothing about the token — keep the session so a retry can still succeed.
    if (axios.isAxiosError(error) && !error.response) return { status: 'unavailable' }
    // Any other answer ends the session, whatever its status. The backend
    // reports every bad refresh token as 401 — unknown, revoked and expired
    // alike — but there is no reading of "the server replied and did not give us
    // a token" that leaves a path back to a usable access token.
    sessionStore.clear()
    return { status: 'rejected' }
  }
}
