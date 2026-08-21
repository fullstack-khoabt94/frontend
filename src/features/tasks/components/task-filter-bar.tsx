import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { FILTER_META, SORT_META } from '../constants'
import { TASK_FILTERS, TASK_SORTS, type TaskFilter, type TaskSort, type TaskStats } from '../schemas'

type Props = {
  filter: TaskFilter
  onFilterChange: (filter: TaskFilter) => void
  search: string
  onSearchChange: (value: string) => void
  sort: TaskSort
  onSortChange: (sort: TaskSort) => void
  stats?: TaskStats
}

/**
 * The five required list views live here. Filter, search and sort are all
 * mirrored into the URL by the route, so any view is linkable and refresh-safe.
 */
export function TaskFilterBar({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
  stats,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="h-10 pr-9 pl-9"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear search"
              onClick={() => onSearchChange('')}
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>

        <Select value={sort} onValueChange={(value) => onSortChange(value as TaskSort)}>
          <SelectTrigger className="h-10 w-full sm:w-48" aria-label="Sort tasks">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_SORTS.map((option) => (
              <SelectItem key={option} value={option}>
                {SORT_META[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Segmented control on md+, a plain select on small screens. */}
      <div className="hidden overflow-x-auto md:block">
        <div
          role="tablist"
          aria-label="Filter tasks by status"
          className="inline-flex gap-1 rounded-xl border bg-card p-1"
        >
          {TASK_FILTERS.map((option) => {
            const active = option === filter
            return (
              <button
                key={option}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => onFilterChange(option)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  active
                    ? 'bg-brand-900 text-white dark:bg-brand-200 dark:text-brand-900'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {FILTER_META[option].shortLabel}
                {stats && (
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-xs tabular-nums',
                      active ? 'bg-white/20 dark:bg-brand-900/15' : 'bg-muted',
                    )}
                  >
                    {stats[option]}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="md:hidden">
        <Select value={filter} onValueChange={(value) => onFilterChange(value as TaskFilter)}>
          <SelectTrigger className="h-10 w-full" aria-label="Filter tasks by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TASK_FILTERS.map((option) => (
              <SelectItem key={option} value={option}>
                {FILTER_META[option].label}
                {stats ? ` (${stats[option]})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
