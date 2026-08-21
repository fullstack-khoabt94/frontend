import { useSyncExternalStore } from 'react'
import type { User } from './schemas'

export type Session = {
  accessToken: string | null
  user: User | null
}

const EMPTY: Session = { accessToken: null, user: null }

let state: Session = EMPTY
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/**
 * Single source of truth for "who is signed in".
 *
 * It is a plain external store (not React context) on purpose: the axios
 * interceptor and the TanStack Router `beforeLoad` guards both need to read the
 * token outside of React's render cycle.
 *
 * The session is held **in memory only** — a reload signs the user out. Adding
 * persistence (httpOnly cookie, refresh-token exchange, storage of your choice)
 * is a backend concern, and hydrating `state` here is the only change the rest
 * of the app needs.
 */
export const sessionStore = {
  getState: () => state,
  isAuthenticated: () => Boolean(state.accessToken),
  set(next: Session) {
    state = next
    emit()
  },
  setUser(user: User) {
    this.set({ ...state, user })
  },
  clear() {
    state = EMPTY
    emit()
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
