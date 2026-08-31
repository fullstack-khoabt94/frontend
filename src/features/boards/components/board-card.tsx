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
import { DEFAULT_PAGE_SIZE } from '@/features/tasks/schemas'
import { BOARD_COLOR_META } from '../constants'
import { DEFAULT_BOARD_ICON, type Board } from '../schemas'

type Props = {
  board: Board
  onEdit: (board: Board) => void
  onArchive: (board: Board) => void
}

export function BoardCard({ board, onEdit, onArchive }: Props) {
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
              search={{
                filter: 'all',
                q: '',
                sort: 'created_desc',
                page: 1,
                size: DEFAULT_PAGE_SIZE,
              }}
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

        {/* The progress bar that used to sit here is gone: `BoardResponse`
            carries no counts and the task endpoint is now board-scoped and
            paged, so there is nothing left to derive "3 of 8 done" from. See
            `features/boards/list.ts`. */}
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
      </div>
    </li>
  )
}
