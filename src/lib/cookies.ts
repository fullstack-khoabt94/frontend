/**
 * Minimal `document.cookie` wrapper.
 *
 * These are cookies the browser owns: readable from JavaScript, so they can only
 * ever hold what the client is already allowed to see. Anything the server needs
 * to trust belongs in an httpOnly cookie set by the backend instead.
 */

type CookieOptions = {
  /** Lifetime in seconds. Omit for a session cookie that dies with the browser. */
  maxAge?: number
  path?: string
  sameSite?: 'Lax' | 'Strict' | 'None'
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${encodeURIComponent(name)}=`
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length))
  }
  return null
}

export function writeCookie(name: string, value: string, options: CookieOptions = {}) {
  if (typeof document === 'undefined') return
  const { maxAge, path = '/', sameSite = 'Lax' } = options
  const attributes = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `SameSite=${sameSite}`,
  ]
  if (maxAge !== undefined) attributes.push(`Max-Age=${Math.floor(maxAge)}`)
  // `Secure` is right in production but would make the cookie unwritable on the
  // plain-http dev server, so it follows the current protocol.
  if (window.location.protocol === 'https:') attributes.push('Secure')
  document.cookie = attributes.join('; ')
}

export function deleteCookie(name: string, path = '/') {
  if (typeof document === 'undefined') return
  document.cookie = `${encodeURIComponent(name)}=; Path=${path}; Max-Age=0; SameSite=Lax`
}
