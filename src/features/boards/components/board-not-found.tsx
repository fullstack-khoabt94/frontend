import { Link } from '@tanstack/react-router'
import { ChevronLeft, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Rendered inside the `/_app` layout, so the header stays and the visitor can
 * navigate away without the full-screen root 404.
 *
 * The API answers 404 both for a board that does not exist and for one owned by
 * someone else, so the copy does not claim which it was.
 */
export function BoardNotFound() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-20 text-center">
        <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
          <SearchX className="size-5" />
        </span>
        <p className="text-sm font-medium tracking-widest text-brand-500 uppercase">404</p>
        <div className="max-w-sm space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Board not found</h1>
          <p className="text-sm text-muted-foreground">
            This board does not exist or you do not have access to it. Check the link, or pick a
            board from your list.
          </p>
        </div>
        <Button asChild size="lg" className="mt-2">
          <Link to="/boards" search={{ view: 'active', q: '' }}>
            <ChevronLeft className="size-4" />
            Back to boards
          </Link>
        </Button>
      </div>
    </main>
  )
}
