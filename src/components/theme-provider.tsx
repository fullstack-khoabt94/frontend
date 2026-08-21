import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { getSystemTheme, ThemeContext, type Theme } from '@/lib/theme-context'

/**
 * Theming, held **in memory only**.
 *
 * Defaults to `light` rather than following the OS — the product picks the theme,
 * the visitor overrides it with the toggle.
 *
 * The choice is intentionally not persisted: nothing in this app writes to browser
 * storage. Add persistence here (and hydrate the initial `theme`) if the preference
 * should survive a reload.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemTheme(media.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme = theme === 'system' ? systemTheme : theme

  // Layout effect so the class lands before the first paint — no flash of the
  // wrong theme on a dark-mode machine.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const handleSetTheme = useCallback((next: Theme) => setTheme(next), [])

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme: handleSetTheme }),
    [theme, resolvedTheme, handleSetTheme],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
