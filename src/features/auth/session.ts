import { useSyncExternalStore } from 'react'
import type { User } from './schemas'

const STORAGE_KEY = 'todo.session'

export type Session = {
  accessToken: string | null
  user: User | null
}

const EMPTY: Session = { accessToken: null, user: null }

function read(): Session {
  if (typeof window === 'undefined') return EMPTY
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Session) : EMPTY
  } catch {
    return EMPTY
  }
}

let state: Session = read()
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
 */
export const sessionStore = {
  getState: () => state,
  isAuthenticated: () => Boolean(state.accessToken),
  set(next: Session) {
    state = next
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    emit()
  },
  setUser(user: User) {
    this.set({ ...state, user })
  },
  clear() {
    state = EMPTY
    window.localStorage.removeItem(STORAGE_KEY)
    emit()
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export function useSession() {
  return useSyncExternalStore(
    (listener) => sessionStore.subscribe(listener),
    () => sessionStore.getState(),
    () => EMPTY,
  )
}
