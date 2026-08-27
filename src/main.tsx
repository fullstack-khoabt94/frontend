import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { sessionStore } from '@/features/auth/session'
import { router } from '@/router'
import './index.css'

// Must run before the router mounts: the route guards read the session
// synchronously in `beforeLoad`, so a remembered visitor has to be signed in
// already by the time the first navigation is resolved.
sessionStore.hydrate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
