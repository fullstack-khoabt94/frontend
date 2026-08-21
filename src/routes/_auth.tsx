import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

/**
 * Pathless layout for the public auth screens.
 * A signed-in visitor never sees Login / Signup — they are sent to their tasks.
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context }) => {
    if (context.session.isAuthenticated()) {
      throw redirect({ to: '/tasks' })
    }
  },
  component: Outlet,
})
