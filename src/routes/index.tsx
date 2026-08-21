import { createFileRoute, redirect } from '@tanstack/react-router'

/** `/` is not a page — it forwards to the app or the login screen. */
export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    throw redirect({ to: context.session.isAuthenticated() ? '/tasks' : '/login' })
  },
})
