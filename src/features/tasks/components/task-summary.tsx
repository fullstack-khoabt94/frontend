import { CheckCircle2, Circle, ListTodo, Timer } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { TaskStats } from '../schemas'

const CARDS = [
  { key: 'all', label: 'All tasks', icon: ListTodo, tone: 'text-brand-900 dark:text-brand-200' },
  { key: 'todo', label: 'To do', icon: Circle, tone: 'text-status-todo' },
  { key: 'in_progress', label: 'In progress', icon: Timer, tone: 'text-status-progress' },
  { key: 'done', label: 'Done', icon: CheckCircle2, tone: 'text-status-done' },
] as const

type Props = {
  /**
   * Board-wide counts from `useTaskStats`, not a tally of the rows on screen —
   * so "3 done" means three in the board, on page one or page four alike. The
   * page-scoped caption that used to sit above these cards went with the
   * client-side filtering that made it necessary.
   */
  stats?: TaskStats
  isLoading?: boolean
  /**
   * Set when a search term or a priority is narrowing the board, which these
   * counts follow — a badge has to say how many rows clicking it would show.
   * The cards then describe the matches, not the board, and the caption says so.
   */
  isNarrowed?: boolean
}

export function TaskSummary({ stats, isLoading, isNarrowed }: Props) {
  const completion = stats && stats.all > 0 ? Math.round((stats.done / stats.all) * 100) : 0

  return (
    <section aria-label="Task overview" className="space-y-4">
      {isNarrowed && (
        <p className="text-xs text-muted-foreground">
          Counts describe the tasks matching your search, not the whole board.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {CARDS.map(({ key, label, icon: Icon, tone }) => (
          <div key={key} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className={cn('size-4', tone)} />
              {label}
            </div>
            {isLoading || !stats ? (
              <span className="mt-2 block h-8 w-10 animate-pulse rounded bg-muted" />
            ) : (
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                {stats[key]}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Completion</span>
          <span className="text-muted-foreground tabular-nums">{completion}%</span>
        </div>
        <Progress value={completion} className="h-2" />
      </div>
    </section>
  )
}
