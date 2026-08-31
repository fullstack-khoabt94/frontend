import { Link } from '@tanstack/react-router'
import { Archive, MoreHorizontal, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { BOARD_COLOR_META } from '../constants'
import { DEFAULT_BOARD_ICON, type Board, type BoardProgress } from '../schemas'

type Props = {
  board: Board
  progress: BoardProgress
  /** `false` while the task list backing the counts is still loading. */
  hasProgress: boolean
  onEdit: (board: Board) => void
  onArchive: (board: Board) => void
}

export function BoardCard({ board, progress, hasProgress, onEdit, onArchive }: Props) {
  const color = BOARD_COLOR_META[board.color]

  return (
    <li
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-colors',
        'hover:border-brand-200 hover:bg-brand-50/40 dark:hover:bg-accent/40',
        'focus-within:border-brand-200',
        board.isArchived && 'opacity-75',
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-full', color.rail)} />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-xl text-lg',
              color.tile,
            )}
          >
            {board.icon ?? DEFAULT_BOARD_ICON}
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            {/* The link is stretched over the card so the whole tile is
                clickable, while the menu below opts back out with `relative`.
                Nesting the menu button inside an <a> instead would be invalid
                markup and would swallow its clicks. */}
            <Link
              to="/boards/$boardId"
              params={{ boardId: board.id }}
              search={{ filter: 'all', q: '', sort: 'priority_desc' }}
              className="font-medium wrap-anywhere before:absolute before:inset-0 before:content-[''] focus-visible:outline-none"
            >
              {board.title}
            </Link>
            {board.description && (
              <p className="line-clamp-2 text-sm text-muted-foreground wrap-anywhere">
                {board.description}
              </p>
            )}
          </div>

          <div className="relative shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${board.title}`}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => onEdit(board)}>
                  <Pencil className="size-4" />
                  Edit board
                </DropdownMenuItem>
                {/* No Restore and no Delete: `DELETE /board/{id}` soft-deletes,
                    and nothing sets `isArchived` back or removes the row. An
                    archived board keeps only Edit. */}
                {!board.isArchived && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => onArchive(board)}>
                      <Archive className="size-4" />
                      Archive board
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {hasProgress ? (
              <span className="tabular-nums">
                {progress.total === 0
                  ? 'No tasks yet'
                  : `${progress.done} of ${progress.total} done`}
              </span>
            ) : (
              <span className="block h-3 w-24 animate-pulse rounded bg-muted" />
            )}
            {hasProgress && progress.total > 0 && (
              <span className="tabular-nums">{progress.completion}%</span>
            )}
          </div>

          {/* Not the shadcn <Progress>: that primitive paints its indicator with
              `bg-primary`, and these bars carry the board's own accent. */}
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={hasProgress ? progress.completion : undefined}
            aria-label={`${board.title} completion`}
          >
            <span
              className={cn('block h-full rounded-full transition-[width]', color.bar)}
              style={{ width: `${hasProgress ? progress.completion : 0}%` }}
            />
          </div>
        </div>
      </div>
    </li>
  )
}

export function BoardCardSkeleton() {
  return (
    <li className="overflow-hidden rounded-xl border bg-card">
      <span className="block h-1.5 w-full bg-muted" />
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <span className="size-10 shrink-0 animate-pulse rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <span className="block h-4 w-2/3 animate-pulse rounded bg-muted" />
            <span className="block h-3 w-full animate-pulse rounded bg-muted" />
          </div>
        </div>
        <span className="block h-1.5 w-full animate-pulse rounded-full bg-muted" />
      </div>
    </li>
  )
}
