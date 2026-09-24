import { CalendarClock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
// Temporarily hidden — see the commented-out checkbox in `TaskItem`.
// import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BOARD_COLOR_META } from '@/features/boards/constants'
import { DEFAULT_BOARD_ICON, type Board } from '@/features/boards/schemas'
import { TagChip } from '@/features/tags/components/tag-chip'
import { formatDueDate, isOverdue } from '@/lib/format'
import { cn } from '@/lib/utils'
import { STATUS_META } from '../constants'
import { sortTags, TASK_STATUSES, type Task, type TaskStatus } from '../schemas'
import { PriorityIcon } from './priority-icon'

/** Tags shown as chips on a row before the rest collapse into "+N". */
const MAX_VISIBLE_TAGS = 2

type Props = {
  task: Task
  /**
   * Opens the task. `editing` is set by the menu's "Edit task", which opens
   * the title and description as editors; clicking the row opens them to read.
   */
  onEdit: (task: Task, options?: { editing: boolean }) => void
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
  /**
   * Two chips at most on the row; the rest fold into a "+N" whose hover card
   * shows them all. Sorted first so the two shown are stable between fetches.
   */
  const sortedTags = sortTags(task.tags)
  const visibleTags = sortedTags.slice(0, MAX_VISIBLE_TAGS)
  const hiddenTags = sortedTags.slice(MAX_VISIBLE_TAGS)
  const overdue = !isDone && isOverdue(task.dueDate)

  /** Clicking the checkbox is the fastest path between "done" and "not done". */
  // const toggleDone = () => onStatusChange(task, isDone ? 'TODO' : 'DONE')

  return (
    // The whole row opens the task. Clicks from the controls on the right are
    // stopped at their wrapper — React bubbles through portals, so that also
    // covers the status and actions menus rendered outside the row.
    <li
      onClick={() => onEdit(task)}
      className={cn(
        // Below `sm` the controls drop onto a second line under the title; from
        // `sm` they sit at the right end of one line.
        'group relative flex cursor-pointer flex-col gap-2 overflow-hidden bg-card px-4 py-2 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:px-5',
        'hover:bg-brand-50/40 dark:hover:bg-accent/40',
        isMutating && 'opacity-60',
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-1', STATUS_META[task.status].rail)}
      />

      {/* Temporarily hidden; the Finish / Reopen buttons still change status.
      <Checkbox
        checked={isDone}
        onCheckedChange={toggleDone}
        aria-label={isDone ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        className="mt-0.5 ml-1 size-5"
      />
      */}

      <div className="min-w-0 flex-1 space-y-1">
        {/* Title and tags share the line: the title takes what is left and
            truncates, the tags hug the right edge of this column, and the
            margin after them keeps a clear gap before the row's controls. */}
        <div className="flex min-w-0 items-center gap-3">
          {/* A button so the row is reachable by keyboard; its click bubbles
              to the row's handler rather than opening the task a second time.
              One line, cut with an ellipsis; the full title is on hover. */}
          <button
            type="button"
            title={task.title}
            className={cn(
              'block min-w-0 flex-1 cursor-pointer truncate rounded-sm text-left text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              isDone && 'text-muted-foreground line-through',
            )}
          >
            {task.title}
          </button>

          {task.tags.length > 0 && (
            // Sorted rather than rendered in arrival order: `TaskResponse.tags`
            // is a `Set`, so two fetches of the same task can hand back the
            // same chips in a different order and the row would reshuffle for
            // no visible reason. Read-only here — the dialog edits tags. Capped
            // at half the column so a heavily tagged task keeps its title.
            <div className="flex max-w-1/2 shrink-0 items-center justify-end gap-1 overflow-hidden sm:mr-10">
              {visibleTags.map((tag) => (
                <TagChip key={tag.id} tag={tag} />
              ))}
              {hiddenTags.length > 0 && (
                // A card rather than a tooltip: it shows every tag as its chip,
                // colours included, which a line of text cannot.
                <HoverCard openDelay={100} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <span
                      tabIndex={0}
                      aria-label={`${hiddenTags.length} more tags: ${hiddenTags.map((tag) => tag.title).join(', ')}`}
                      className="inline-flex shrink-0 cursor-default items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      +{hiddenTags.length}
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent
                    align="end"
                    className="w-auto max-w-72 cursor-default"
                    // Portalled, but React still bubbles its clicks to the row.
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {sortedTags.length} tags
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {sortedTags.map((tag) => (
                        <TagChip key={tag.id} tag={tag} />
                      ))}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              )}
            </div>
          )}
        </div>

        {(board || !task.boardId) && (
          <div className="flex flex-wrap items-center gap-2">
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
          </div>
        )}
      </div>

      <div
        className="flex shrink-0 cursor-default items-center gap-1.5 self-end sm:self-auto"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Only an overdue task gets a marker; the date waits in the tooltip.
              Focusable so keyboard users can reach the tooltip too. */}
        {overdue ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                role="img"
                tabIndex={0}
                aria-label={`Overdue since ${due}`}
                className="grid size-6 place-items-center rounded-md text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <CalendarClock className="size-4" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Overdue · {due}</TooltipContent>
          </Tooltip>
        ) : (
          // Same footprint when not overdue, so the controls are one width on
          // every row and the tags to their left line up down the list. Not
          // needed on phones, where the controls have a line of their own.
          <span aria-hidden className="hidden size-6 sm:block" />
        )}

        {/* Replaces the old Start / Finish / Reopen buttons: any status is
              one pick away, and the trigger doubles as the row's status pill. */}
        <Select
          value={task.status}
          onValueChange={(value) => onStatusChange(task, value as TaskStatus)}
          disabled={isMutating}
        >
          <SelectTrigger
            size="sm"
            aria-label={`Status of ${task.title}`}
            className={cn(
              // Fixed width so every status lines up down the list; the label
              // takes the room left of the chevron and centres in it. The
              // chevron's own muted colour is overridden to match the text.
              'w-24 gap-0.5 rounded-[6px] border-transparent px-1 py-0 text-[11px] leading-none font-bold text-white uppercase data-[size=sm]:h-5 data-[size=sm]:rounded-[6px] dark:text-background',
              '*:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:justify-center [&_svg]:size-2.5 [&_svg]:text-current',
              STATUS_META[task.status].solid,
            )}
          >
            {/* Children override `SelectValue`'s mirror of the chosen item, so
                  the pill shows the label alone while the menu keeps icons. */}
            <SelectValue>{STATUS_META[task.status].label}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {TASK_STATUSES.map((status) => {
              const { icon: Icon, label, tone } = STATUS_META[status]
              return (
                <SelectItem key={status} value={status}>
                  <Icon className={tone} />
                  <span className={tone}>{label}</span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <PriorityIcon priority={task.priority} labelled />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${task.title}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => onEdit(task, { editing: true })}>
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
  // Mirrors the row: the title line, then the controls — below it on phones,
  // at its right end from `sm`.
  return (
    <li className="flex flex-col gap-2 bg-card px-4 py-2 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <span className="block h-5 flex-1 animate-pulse rounded bg-muted sm:max-w-2/3" />
      <span className="block h-5 w-24 self-end animate-pulse rounded-[6px] bg-muted sm:ml-auto sm:self-auto" />
    </li>
  )
}
