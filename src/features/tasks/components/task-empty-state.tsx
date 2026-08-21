import { ClipboardList, Plus, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FILTER_META } from '../constants'
import type { TaskFilter } from '../schemas'

const EMPTY_COPY: Record<TaskFilter, { title: string; body: string }> = {
  all: { title: 'No tasks yet', body: 'Create your first task and it will show up right here.' },
  not_done: { title: 'Nothing outstanding', body: 'Every task is done. Enjoy the clear list.' },
  todo: { title: 'No tasks waiting', body: 'Nothing is sitting in the backlog right now.' },
  in_progress: { title: 'Nothing in progress', body: 'Start a task to see it appear here.' },
  done: { title: 'No completed tasks', body: 'Finish a task and it will be archived here.' },
}

export function TaskEmptyState({
  filter,
  search,
  onCreate,
  onClearSearch,
}: {
  filter: TaskFilter
  search: string
  onCreate: () => void
  onClearSearch: () => void
}) {
  if (search) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
        <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
          <SearchX className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">No results for “{search}”</p>
          <p className="text-sm text-muted-foreground">
            Try a different keyword, or clear the search to see {FILTER_META[filter].label.toLowerCase()}.
          </p>
        </div>
        <Button variant="outline" size="lg" onClick={onClearSearch}>
          Clear search
        </Button>
      </div>
    )
  }

  const copy = EMPTY_COPY[filter]

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-900 dark:bg-accent dark:text-brand-200">
        <ClipboardList className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="font-medium">{copy.title}</p>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
      </div>
      <Button size="lg" onClick={onCreate}>
        <Plus className="size-4" />
        New task
      </Button>
    </div>
  )
}
