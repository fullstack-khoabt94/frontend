import { Archive, LayoutGrid, Plus, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BoardView } from '../schemas'

type Props = {
  view: BoardView
  search: string
  onCreate: () => void
  onClearSearch: () => void
}

/** Specific copy per situation, matching `TaskEmptyState`. */
export function BoardEmptyState({ view, search, onCreate, onClearSearch }: Props) {
  if (search) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
        <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
          <SearchX className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">No results for “{search}”</p>
          <p className="text-sm text-muted-foreground">
            No {view} board matches that name. Try a different keyword.
          </p>
        </div>
        <Button variant="outline" size="lg" onClick={onClearSearch}>
          Clear search
        </Button>
      </div>
    )
  }

  if (view === 'archived') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
        <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Archive className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">Nothing archived</p>
          <p className="text-sm text-muted-foreground">
            Boards you archive are kept here, tasks and all, until you restore or delete them.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-900 dark:bg-accent dark:text-brand-200">
        <LayoutGrid className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="font-medium">No boards yet</p>
        <p className="text-sm text-muted-foreground">
          Boards group related tasks. Create one and your tasks get a home.
        </p>
      </div>
      <Button size="lg" onClick={onCreate}>
        <Plus className="size-4" />
        New board
      </Button>
    </div>
  )
}
