import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppHeader } from '@/components/layout/app-header'
import { TooltipProvider } from '@/components/ui/tooltip'

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
  // `overflow-x-clip`, not `hidden`: it trims full-bleed backdrops (the board's
  // sticky filters) without becoming a scroll container, which would break
  // every `position: sticky` below it.
  return (
    <div className="min-h-svh overflow-x-clip bg-background">
      {/* One provider for every tooltip in the app — Radix requires it. */}
      <TooltipProvider delayDuration={200}>
        <AppHeader />
        <Outlet />
      </TooltipProvider>
    </div>
  )
}
