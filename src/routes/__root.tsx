import { lazy, Suspense } from 'react'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { ensureSessionVerified } from '@/features/auth/verify-session'
import type { sessionStore } from '@/features/auth/session'

/** Devtools are dev-only and code-split so they never reach the prod bundle. */
const Devtools = import.meta.env.DEV
  ? lazy(async () => {
      const [{ TanStackRouterDevtools }, { ReactQueryDevtools }] = await Promise.all([
        import('@tanstack/react-router-devtools'),
        import('@tanstack/react-query-devtools'),
      ])
      return {
        default: () => (
          <>
            <TanStackRouterDevtools position="bottom-left" />
            <ReactQueryDevtools initialIsOpen={false} />
          </>
        ),
      }
    })
  : () => null

export type RouterContext = {
  queryClient: QueryClient
  session: typeof sessionStore
}

export const Route = createRootRouteWithContext<RouterContext>()({
  /**
   * The root guard runs ahead of every other `beforeLoad`, which is the only
   * place a restored token can be checked before `/`, `/_auth` and `/_app` each
   * branch on `isAuthenticated()`. It is a no-op on every navigation after the
   * first, and on any load that did not restore a session.
   */
  beforeLoad: () => ensureSessionVerified(),
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: RouteError,
})

function RootLayout() {
  return (
    <ThemeProvider>
      <Outlet />
      <Toaster richColors closeButton position="bottom-right" />
      <Suspense>
        <Devtools />
      </Suspense>
    </ThemeProvider>
  )
}

function CenteredMessage({ code, title, body }: { code: string; title: string; body: string }) {
  return (
    <div className="grid min-h-svh place-items-center px-6">
      <div className="max-w-sm space-y-4 text-center">
        <p className="text-sm font-medium tracking-widest text-brand-500 uppercase">{code}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
        <Button size="lg" asChild>
          <Link to="/tasks">Back to my tasks</Link>
        </Button>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <CenteredMessage
      code="404"
      title="Page not found"
      body="The page you were looking for does not exist or has been moved."
    />
  )
}

function RouteError({ error }: { error: Error }) {
  return (
    <CenteredMessage
      code="Error"
      title="Something went wrong"
      body={error.message || 'An unexpected error occurred. Try again in a moment.'}
    />
  )
}
