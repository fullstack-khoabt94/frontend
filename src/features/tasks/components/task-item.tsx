import {
  CalendarClock,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BOARD_COLOR_META } from '@/features/boards/constants'
import { DEFAULT_BOARD_ICON, type Board } from '@/features/boards/schemas'
import { formatDueDate, isOverdue } from '@/lib/format'
import { cn } from '@/lib/utils'
import { STATUS_META } from '../constants'
import { TASK_STATUSES, type Task, type TaskStatus } from '../schemas'
import { PriorityBadge, StatusBadge } from './status-badge'

type Props = {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
  isMutating?: boolean
  /**
   * The task's board, shown as a chip. Nothing passes it today: the list
   * endpoint is nested under a board, so the only task list is inside one, where
   * every row would carry the same chip and tell the reader nothing. It stays
   * for the cross-board screen a top-level endpoint would bring back.
   */
  board?: Board
}

export function TaskItem({ task, onEdit, onDelete, onStatusChange, isMutating, board }: Props) {
  const isDone = task.status === 'DONE'
  const due = formatDueDate(task.dueDate)
  const overdue = !isDone && isOverdue(task.dueDate)

  /** Clicking the checkbox is the fastest path between "done" and "not done". */
  const toggleDone = () => onStatusChange(task, isDone ? 'TODO' : 'DONE')

  return (
    <li
      className={cn(
        'group relative flex gap-3 overflow-hidden rounded-xl border bg-card p-4 transition-colors sm:gap-4 sm:p-5',
        'hover:border-brand-200 hover:bg-brand-50/40 dark:hover:bg-accent/40',
        isMutating && 'opacity-60',
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-1', STATUS_META[task.status].rail)}
      />

      <Checkbox
        checked={isDone}
        onCheckedChange={toggleDone}
        aria-label={isDone ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        className="mt-0.5 ml-1 size-5"
      />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-1">
          <p
            className={cn(
              'font-medium wrap-anywhere transition-colors',
              isDone && 'text-muted-foreground line-through',
            )}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground wrap-anywhere">
              {task.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
          {board && (
            <span
              className={cn(
                'inline-flex max-w-40 items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                BOARD_COLOR_META[board.color].tile,
              )}
            >
              <span aria-hidden>{board.icon ?? DEFAULT_BOARD_ICON}</span>
              <span className="truncate">{board.title}</span>
            </span>
          )}
          {/* Only reachable for tasks that predate boards; the form requires one. */}
          {!board && !task.boardId && (
            <span className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
              No board
            </span>
          )}
          {due && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs',
                overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
              )}
            >
              <CalendarClock className="size-3" />
              {overdue ? `Overdue · ${due}` : due}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-start gap-1">
        {task.status === 'TODO' && (
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-status-progress hover:text-status-progress sm:inline-flex"
            onClick={() => onStatusChange(task, 'IN_PROGRESS')}
          >
            <Play className="size-3.5" />
            Start
          </Button>
        )}
        {task.status === 'IN_PROGRESS' && (
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-status-done hover:text-status-done sm:inline-flex"
            onClick={() => onStatusChange(task, 'DONE')}
          >
            <CheckCircle2 className="size-3.5" />
            Finish
          </Button>
        )}
        {isDone && (
          <Button
            variant="ghost"
            size="sm"
            className="hidden text-muted-foreground sm:inline-flex"
            onClick={() => onStatusChange(task, 'TODO')}
          >
            <RotateCcw className="size-3.5" />
            Reopen
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${task.title}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={task.status}
              onValueChange={(value) => onStatusChange(task, value as TaskStatus)}
            >
              {TASK_STATUSES.map((status) => (
                <DropdownMenuRadioItem key={status} value={status}>
                  {STATUS_META[status].label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onEdit(task)}>
              <Pencil className="size-4" />
              Edit task
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(task)}>
              <Trash2 className="size-4" />
              Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

export function TaskItemSkeleton() {
  return (
    <li className="flex gap-4 rounded-xl border bg-card p-5">
      <span className="mt-0.5 size-5 shrink-0 animate-pulse rounded bg-muted" />
      <div className="flex-1 space-y-2.5">
        <span className="block h-4 w-2/3 animate-pulse rounded bg-muted" />
        <span className="block h-3 w-full animate-pulse rounded bg-muted" />
        <div className="flex gap-2 pt-1">
          <span className="block h-5 w-20 animate-pulse rounded-full bg-muted" />
          <span className="block h-5 w-16 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </li>
  )
}
