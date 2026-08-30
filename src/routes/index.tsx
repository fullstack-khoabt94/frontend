import { createFileRoute, redirect } from '@tanstack/react-router'

/** `/` is not a page — it forwards to the app or the login screen. */
export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    // Boards are the entry point: tasks live inside one, so that is where a
    // signed-in visitor starts.
    if (!context.session.isAuthenticated()) throw redirect({ to: '/login' })
    throw redirect({ to: '/boards', search: { view: 'active', q: '' } })
  },
})
