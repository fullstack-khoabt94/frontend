import { Plus, SearchX, Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  search: string
  onCreate: () => void
  onClearSearch: () => void
}

/** Specific copy per situation, matching `BoardEmptyState` and `TaskEmptyState`. */
export function TagEmptyState({ search, onCreate, onClearSearch }: Props) {
  if (search) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
        <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
          <SearchX className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">No results for “{search}”</p>
          <p className="text-sm text-muted-foreground">
            No tag matches that name or description. Try a different keyword.
          </p>
        </div>
        <Button variant="outline" size="lg" onClick={onClearSearch}>
          Clear search
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        <Tags className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="font-medium">No tags yet</p>
        <p className="text-sm text-muted-foreground">
          Tags cut across boards — one label you can put on any task, wherever it lives.
        </p>
      </div>
      <Button size="lg" onClick={onCreate}>
        <Plus className="size-4" />
        New tag
      </Button>
    </div>
  )
}
