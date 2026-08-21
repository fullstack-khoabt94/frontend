import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppHeader } from '@/components/layout/app-header'

/**
 * Pathless layout for everything behind authentication.
 * The guard records where the visitor was heading so login can send them back.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context, location }) => {
    if (!context.session.isAuthenticated()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <Outlet />
    </div>
  )
}
