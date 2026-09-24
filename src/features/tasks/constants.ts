import { CheckCircle2, Circle, Timer, type LucideIcon } from 'lucide-react'
import type { TaskFilter, TaskPriority, TaskSort, TaskStatus } from './schemas'

type StatusMeta = {
  label: string
  icon: LucideIcon
  /** Tailwind classes for the badge / status pill. */
  badge: string
  /** Accent colour used for the left rail of a task row. */
  rail: string
  /**
   * Solid fill for the status pill on a task row, which carries white text.
   * The `dark:` pair overrides `SelectTrigger`'s own dark background.
   */
  solid: string
  /**
   * Text colour for the icon and label inside a select item — important for
   * the same reason as `PRIORITY_META.tone`.
   */
  tone: string
  /** Label of the button that moves a task *into* this status. */
  action: string
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  TODO: {
    label: 'To do',
    icon: Circle,
    badge: 'bg-status-todo-soft text-status-todo border-status-todo/20',
    rail: 'bg-status-todo/35',
    solid:
      'bg-status-todo/70 hover:bg-status-todo/60 dark:bg-status-todo/70 dark:hover:bg-status-todo/60',
    tone: 'text-status-todo!',
    action: 'Move to to do',
  },
  IN_PROGRESS: {
    label: 'In progress',
    icon: Timer,
    badge: 'bg-status-progress-soft text-status-progress border-status-progress/25',
    rail: 'bg-status-progress',
    solid:
      'bg-status-progress dark:bg-status-progress dark:hover:bg-status-progress/90 hover:bg-status-progress/90',
    tone: 'text-status-progress!',
    action: 'Start progress',
  },
  DONE: {
    label: 'Done',
    icon: CheckCircle2,
    badge: 'bg-status-done-soft text-status-done border-status-done/25',
    rail: 'bg-status-done',
    solid:
      'bg-status-done dark:bg-status-done dark:hover:bg-status-done/90 hover:bg-status-done/90',
    tone: 'text-status-done!',
    action: 'Mark as done',
  },
}

export const PRIORITY_META: Record<
  TaskPriority,
  {
    label: string
    badge: string
    /**
     * Colour of `PriorityIcon`: one red, deepening with the level. Marked
     * important (`!`) because `SelectItem` recolours every descendant on
     * focus, and the priority colour should survive hover and keyboard focus.
     * Kept literal so Tailwind can see it — a class built at runtime is not
     * generated.
     */
    tone: string
  }
> = {
  LOW: {
    label: 'Low',
    badge: 'text-muted-foreground border-border',
    tone: 'text-destructive/40!',
  },
  MEDIUM: {
    label: 'Medium',
    badge: 'text-brand-700 border-brand-200 dark:text-brand-200',
    tone: 'text-destructive/70!',
  },
  HIGH: {
    label: 'High',
    badge: 'text-destructive border-destructive/30',
    tone: 'text-destructive!',
  },
}

export const FILTER_META: Record<TaskFilter, { label: string; shortLabel: string }> = {
  all: { label: 'All tasks', shortLabel: 'All' },
  not_done: { label: 'Not done', shortLabel: 'Not done' },
  todo: { label: 'To do', shortLabel: 'To do' },
  in_progress: { label: 'In progress', shortLabel: 'In progress' },
  done: { label: 'Done', shortLabel: 'Done' },
}

/**
 * Only orderings `TaskServiceImpl.ALLOWED_SORT` actually honours — the server
 * sorts now, and an option it drops would silently fall back to `id DESC`.
 */
export const SORT_META: Record<TaskSort, string> = {
  created_desc: 'Newest first',
  created_asc: 'Oldest first',
  due_asc: 'Due soonest',
  due_desc: 'Due latest',
}
