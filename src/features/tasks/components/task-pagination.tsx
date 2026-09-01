import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { PAGE_SIZE_OPTIONS } from '../schemas'

export type PageMeta = {
  /** One-based, matching the URL. */
  page: number
  size: number
  total: number
  totalPages: number
}

type Props = {
  meta: PageMeta
  onPageChange: (page: number) => void
  onSizeChange: (size: number) => void
  /** True while the next page is in flight and the previous one is still shown. */
  isFetching?: boolean
  /**
   * Set when the status filter or the search box is narrowing the page, which
   * makes the rows on screen a subset of `meta.size`. The range then describes
   * what was *fetched*, not what is visible, and the caption says so.
   */
  isNarrowed?: boolean
}

/**
 * Windowed page numbers: first, last, and the neighbours of the current page,
 * with `null` standing in for a gap. A board with 40 pages must not render 40
 * buttons, and the ends stay reachable in one click.
 */
function pageWindow(current: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)

  const pages = new Set([1, totalPages, current, current - 1, current + 1])
  const sorted = [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b)

  return sorted.flatMap((page, index) => {
    const previous = sorted[index - 1]
    return previous !== undefined && page - previous > 1 ? [null, page] : [page]
  })
}

/**
 * The pagination footer, and the only place on the screen that reports the
 * board's real totals.
 *
 * That matters because everything else in the toolbar is page-scoped: the
 * server takes the board in the path and `page`, `size` and `sort` as params —
 * but no status and no
 * keyword, so the filter tabs and the search box narrow the rows already
 * fetched. `meta.total` is the one number that comes from the database.
 */
export function TaskPagination({
  meta,
  onPageChange,
  onSizeChange,
  isFetching,
  isNarrowed,
}: Props) {
  const { page, size, total, totalPages } = meta

  const firstOnPage = total === 0 ? 0 : (page - 1) * size + 1
  const lastOnPage = Math.min(page * size, total)

  return (
    <nav
      aria-label="Task pagination"
      className="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-1">
        <p aria-live="polite" className="text-sm text-muted-foreground tabular-nums">
          {total === 0
            ? 'No tasks in this board'
            : `Showing ${firstOnPage}–${lastOnPage} of ${total} task${total === 1 ? '' : 's'}`}
        </p>
        {isNarrowed && (
          <p className="text-xs text-muted-foreground">
            The filter and search apply to this page only.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select value={String(size)} onValueChange={(value) => onSizeChange(Number(value))}>
          <SelectTrigger className="h-9 w-28" aria-label="Tasks per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1" aria-busy={isFetching}>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>

          {/* Numbered pages need room; below `sm` the counter carries the same
              information in one line. */}
          <div className="hidden items-center gap-1 sm:flex">
            {pageWindow(page, Math.max(totalPages, 1)).map((entry, index) =>
              entry === null ? (
                <span
                  key={`gap-${index}`}
                  aria-hidden
                  className="px-1 text-sm text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={entry}
                  variant={entry === page ? 'default' : 'ghost'}
                  size="icon-sm"
                  aria-label={`Page ${entry}`}
                  aria-current={entry === page ? 'page' : undefined}
                  onClick={() => onPageChange(entry)}
                  className={cn('tabular-nums', entry === page && 'pointer-events-none')}
                >
                  {entry}
                </Button>
              ),
            )}
          </div>

          <span className="px-2 text-sm text-muted-foreground tabular-nums sm:hidden">
            {page} / {Math.max(totalPages, 1)}
          </span>

          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </nav>
  )
}
