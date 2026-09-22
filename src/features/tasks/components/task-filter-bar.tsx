import { CalendarClock, Flag, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { FILTER_META, PRIORITY_META, SORT_META } from '../constants'
import {
  TASK_FILTERS,
  TASK_PRIORITIES,
  TASK_SORTS,
  type TaskFilter,
  type TaskPriority,
  type TaskSort,
  type TaskStats,
} from '../schemas'

/**
 * Stands in for "no priority filter" inside the select.
 *
 * Radix treats `''` as the empty/placeholder value and will not accept it as an
 * item value, so the cleared state needs a real token here. It never leaves the
 * component: {@link TaskFilterBar} maps it back to `undefined`, which is what
 * keeps `?priority=` out of the URL entirely.
 */
const ANY_PRIORITY = 'ANY'

type Props = {
  filter: TaskFilter
  onFilterChange: (filter: TaskFilter) => void
  search: string
  onSearchChange: (value: string) => void
  priority?: TaskPriority
  onPriorityChange: (priority: TaskPriority | undefined) => void
  /** `yyyy-MM-dd`, or undefined for no deadline filter. */
  dueOnOrBefore?: string
  onDueChange: (date: string | undefined) => void
  sort: TaskSort
  onSortChange: (sort: TaskSort) => void
  stats?: TaskStats
}

/**
 * The five required list views, plus priority and a deadline cut-off.
 *
 * Every control here is a query parameter on `GET /board/{boardId}/task/all`
 * and a search param in the URL, so a view is linkable, refresh-safe, and
 * describes the whole board rather than the page that happens to be loaded.
 */
export function TaskFilterBar({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  priority,
  onPriorityChange,
  dueOnOrBefore,
  onDueChange,
  sort,
  onSortChange,
  stats,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Four controls do not fit on one line at 640 — the search box would be
          squeezed to a few characters — so they drop onto their own row until
          `lg`. The status strip below is unchanged and still the tightest thing
          in the layout. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search task titles…"
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

        <div className="flex flex-col gap-3 sm:flex-row">
          {/* A native date input rather than a calendar popover, matching the
              task form's own due-date field — one date idiom in the app, and
              `yyyy-MM-dd` is already the wire format the backend wants. */}
          <div className="relative flex-1 sm:w-44 sm:flex-none">
            <CalendarClock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={dueOnOrBefore ?? ''}
              onChange={(event) => onDueChange(event.target.value || undefined)}
              aria-label="Show tasks due on or before"
              title="Due on or before"
              className={cn('h-10 pl-9', dueOnOrBefore && 'pr-9')}
            />
            {dueOnOrBefore && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear due date filter"
                onClick={() => onDueChange(undefined)}
                className="absolute top-1/2 right-1.5 -translate-y-1/2"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>

          <Select
            value={priority ?? ANY_PRIORITY}
            onValueChange={(value) =>
              onPriorityChange(value === ANY_PRIORITY ? undefined : (value as TaskPriority))
            }
          >
            <SelectTrigger
              // `SelectTrigger` sets its height as `data-[size=default]:h-8`. A
              // plain `h-10` carries no variant, so tailwind-merge keeps both and
              // the data-attribute selector wins on specificity — the control
              // silently stays 32px beside a 40px input. Matching the variant is
              // what overrides it, here and on every other trigger in the app.
              className="flex-1 data-[size=default]:h-10 sm:w-40 sm:flex-none"
              aria-label="Filter tasks by priority"
            >
              <Flag className="size-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_PRIORITY}>Any priority</SelectItem>
              {TASK_PRIORITIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {PRIORITY_META[option].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={(value) => onSortChange(value as TaskSort)}>
            <SelectTrigger
              className="flex-1 data-[size=default]:h-10 sm:w-48 sm:flex-none"
              aria-label="Sort tasks"
            >
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
      </div>

      {dueOnOrBefore && (
        <p className="text-xs text-muted-foreground">
          Showing tasks due on or before {dueOnOrBefore}. Tasks with no deadline are hidden.
        </p>
      )}

      {/* Segmented control wherever the five options fit, a select below that.
          `ToggleGroup type="single"` is a Radix radiogroup — one of five, no
          panels — which is what this strip actually is. */}
      <div className="hidden overflow-x-auto sm:block">
        <ToggleGroup
          type="single"
          value={filter}
          // Radix allows a single group to deselect back to `''`. A list always
          // has a view, so clicking the active tab is a no-op rather than a way
          // to reach a filter that does not exist.
          onValueChange={(value) => value && onFilterChange(value as TaskFilter)}
          variant="outline"
          size="lg"
          spacing={0}
          aria-label="Filter tasks by status"
        >
          {TASK_FILTERS.map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              aria-label={FILTER_META[option].label}
              className="px-3 data-[state=on]:bg-brand-900 data-[state=on]:text-white dark:data-[state=on]:bg-brand-200 dark:data-[state=on]:text-brand-900"
            >
              {FILTER_META[option].shortLabel}
              {stats && (
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-xs tabular-nums',
                    option === filter ? 'bg-white/20 dark:bg-brand-900/15' : 'bg-muted',
                  )}
                >
                  {stats[option]}
                </span>
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="sm:hidden">
        <Select value={filter} onValueChange={(value) => onFilterChange(value as TaskFilter)}>
          <SelectTrigger
            className="w-full data-[size=default]:h-10"
            aria-label="Filter tasks by status"
          >
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
