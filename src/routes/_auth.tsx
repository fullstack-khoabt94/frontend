import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

/**
 * Pathless layout for the public auth screens.
 * A signed-in visitor never sees Login / Signup — they are sent to their boards.
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context }) => {
    if (context.session.isAuthenticated()) {
      throw redirect({ to: '/boards', search: { view: 'active', q: '' } })
    }
  },
  component: Outlet,
})
