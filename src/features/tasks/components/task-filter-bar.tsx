import { CalendarClock, Flag, ListFilter, Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { PriorityIcon } from './priority-icon'
import { TagFilter } from './tag-filter'

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
  /** Selected tag ids, or undefined for no tag filter. */
  tags?: string[]
  onTagsChange: (tags: string[] | undefined) => void
  /** Resets priority, due date and tags in one navigation. */
  onClearFilters: () => void
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
  tags,
  onTagsChange,
  onClearFilters,
  sort,
  onSortChange,
  stats,
}: Props) {
  /**
   * Filters hidden in the phone's sheet that are narrowing the list, for the
   * dot on its button. Sort is left out — it reorders, it does not hide
   * anything — and so is status, whose tabs stay on screen.
   */
  const activeFilterCount =
    Number(Boolean(priority)) + Number(Boolean(dueOnOrBefore)) + Number(Boolean(tags?.length))

  /**
   * The four filters, drawn once and placed twice: inline in the row from
   * `sm`, stacked in the sheet on phones. `inline` only switches the fixed
   * `lg` widths on.
   */
  const renderFilters = (inline: boolean) => (
    <>
      <div className={cn('relative min-w-0', inline && 'lg:w-44 lg:flex-none')}>
        <CalendarClock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="date"
          value={dueOnOrBefore ?? ''}
          onChange={(event) => onDueChange(event.target.value || undefined)}
          aria-label="Show tasks due on or before"
          title="Due on or before"
          className={cn('bg-white dark:bg-input/30 h-10 pl-9', dueOnOrBefore && 'pr-9')}
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
          className={cn(
            'w-full min-w-0 bg-white data-[size=default]:h-10 dark:bg-input/30',
            inline && 'lg:w-40 lg:flex-none',
          )}
          aria-label="Filter tasks by priority"
        >
          {/* Each item carries its own marker, and `SelectValue` mirrors the
              chosen item — so the trigger shows the flag for "any" and the
              coloured chevrons for a real priority, never both. */}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_PRIORITY}>
            <Flag className="text-muted-foreground!" />
            Any priority
          </SelectItem>
          {TASK_PRIORITIES.map((option) => (
            <SelectItem key={option} value={option}>
              <PriorityIcon priority={option} />
              {PRIORITY_META[option].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <TagFilter
        value={tags}
        onChange={onTagsChange}
        className={cn('w-full min-w-0', inline && 'lg:w-40')}
      />

      <Select value={sort} onValueChange={(value) => onSortChange(value as TaskSort)}>
        <SelectTrigger
          className={cn(
            'w-full min-w-0 bg-white data-[size=default]:h-10 dark:bg-input/30',
            inline && 'lg:w-44 lg:flex-none',
          )}
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
    </>
  )

  return (
    // `gap`, not `space-y`: the tab strip is `display: none` on phones and a
    // gap skips it, where `space-y` would still leave its margin behind.
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center">
        {/* On phones the row is just search and a filter button; everything
            else waits in a sheet so the list is not pushed off the screen. */}
        <div className="flex min-w-0 flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search task titles…"
              aria-label="Search tasks"
              className="bg-white dark:bg-input/30 h-10 pr-9 pl-9"
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

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label={activeFilterCount ? `Filters, ${activeFilterCount} applied` : 'Filters'}
                className="relative size-10 shrink-0 bg-white sm:hidden dark:bg-input/30"
              >
                <ListFilter className="size-4" />
                {activeFilterCount > 0 && (
                  <span
                    aria-hidden
                    className="absolute -top-1 -right-1 size-2.5 rounded-full bg-destructive ring-2 ring-background"
                  />
                )}
              </Button>
            </SheetTrigger>
            {/* From the right and full height, not a bottom sheet: the selects
                and the tag picker open downwards, and at the bottom of the
                screen they would have nowhere to go. */}
            <SheetContent side="right" className="w-[85vw] gap-0">
              <SheetHeader className="border-b">
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription className="sr-only">
                  Narrow and sort the tasks in this board.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                {renderFilters(false)}
              </div>
              <SheetFooter className="flex-row border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={activeFilterCount === 0}
                  onClick={onClearFilters}
                >
                  Clear filters
                </Button>
                <SheetClose asChild>
                  <Button type="button" className="flex-1">
                    Done
                  </Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        {/* From `sm`: two columns, four from `md`, fixed widths beside the
            search box from `lg`. */}
        <div className="hidden grid-cols-2 gap-3 sm:grid md:grid-cols-4 lg:flex lg:flex-row">
          {renderFilters(true)}
        </div>
      </div>

      {dueOnOrBefore && (
        <p className="text-xs text-muted-foreground">
          Showing tasks due on or before {dueOnOrBefore}. Tasks with no deadline are hidden.
        </p>
      )}

      {/* The status tabs, at every width and always full width. There are no
          panels — the list below re-queries instead — so this only borrows the
          tab strip's look and keyboard model. Five tabs only fit a phone with
          the count stacked under each label; from `sm` they share a line. */}
      <Tabs
        value={filter}
        onValueChange={(value) => onFilterChange(value as TaskFilter)}
        className="w-full"
      >
        <TabsList
          className="w-full bg-border/70 group-data-horizontal/tabs:h-12 sm:group-data-horizontal/tabs:h-10 dark:bg-muted"
          aria-label="Filter tasks by status"
        >
          {TASK_FILTERS.map((option) => (
            <TabsTrigger
              key={option}
              value={option}
              aria-label={FILTER_META[option].label}
              // `primary` is the brand blue — brand-900 in light, brand-200 in
              // dark — so the active tab follows the theme without a `dark:` pair.
              className="min-w-0 flex-col gap-0 px-1 text-[11px] leading-4 sm:flex-row sm:gap-1.5 sm:px-1.5 sm:text-sm data-active:bg-primary data-active:text-primary-foreground dark:data-active:border-transparent dark:data-active:bg-primary dark:data-active:text-primary-foreground"
            >
              <span className="truncate">{FILTER_META[option].shortLabel}</span>
              {stats && (
                <span
                  className={cn(
                    'rounded-md px-1.5 text-[10px] leading-4 tabular-nums sm:py-0.5 sm:text-xs',
                    option === filter
                      ? 'bg-primary-foreground/20'
                      : 'bg-background/60 dark:bg-input/30',
                  )}
                >
                  {stats[option]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
