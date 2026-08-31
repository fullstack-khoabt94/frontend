import { CheckCircle2, Circle, Timer, type LucideIcon } from 'lucide-react'
import type { TaskFilter, TaskPriority, TaskSort, TaskStatus } from './schemas'

type StatusMeta = {
  label: string
  icon: LucideIcon
  /** Tailwind classes for the badge / status pill. */
  badge: string
  /** Accent colour used for the left rail of a task row. */
  rail: string
  /** Label of the button that moves a task *into* this status. */
  action: string
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  TODO: {
    label: 'To do',
    icon: Circle,
    badge: 'bg-status-todo-soft text-status-todo border-status-todo/20',
    rail: 'bg-status-todo/35',
    action: 'Move to to do',
  },
  IN_PROGRESS: {
    label: 'In progress',
    icon: Timer,
    badge: 'bg-status-progress-soft text-status-progress border-status-progress/25',
    rail: 'bg-status-progress',
    action: 'Start progress',
  },
  DONE: {
    label: 'Done',
    icon: CheckCircle2,
    badge: 'bg-status-done-soft text-status-done border-status-done/25',
    rail: 'bg-status-done',
    action: 'Mark as done',
  },
}

export const PRIORITY_META: Record<TaskPriority, { label: string; badge: string; dot: string }> = {
  LOW: {
    label: 'Low',
    badge: 'text-muted-foreground border-border',
    dot: 'bg-muted-foreground/50',
  },
  MEDIUM: {
    label: 'Medium',
    badge: 'text-brand-700 border-brand-200 dark:text-brand-200',
    dot: 'bg-brand-500',
  },
  HIGH: { label: 'High', badge: 'text-destructive border-destructive/30', dot: 'bg-destructive' },
}

export const FILTER_META: Record<
  TaskFilter,
  { label: string; shortLabel: string; description: string }
> = {
  all: { label: 'All tasks', shortLabel: 'All', description: 'Everything in your list.' },
  not_done: {
    label: 'Not done',
    shortLabel: 'Not done',
    description: 'To do and in progress combined.',
  },
  todo: { label: 'To do', shortLabel: 'To do', description: 'Not started yet.' },
  in_progress: {
    label: 'In progress',
    shortLabel: 'In progress',
    description: 'Currently being worked on.',
  },
  done: { label: 'Done', shortLabel: 'Done', description: 'Completed tasks.' },
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
