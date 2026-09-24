import { cn } from '@/lib/utils'
import { PRIORITY_META } from '../constants'
import type { TaskPriority } from '../schemas'

/** How many stacked chevrons each level gets — the count is the signal. */
const CHEVRONS: Record<TaskPriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 }

/** 16×16 grid, 4 units between chevrons, the stack centred vertically. */
const STEP = 4
const HEIGHT = 3

/**
 * The priority marker: one, two or three stacked chevrons, coloured by level —
 * grey, brand blue, red.
 *
 * Drawn by hand rather than taken from Lucide, which ships one and two stacked
 * chevrons but not three. The one place that draws it, so the filter, the task
 * form and the task rows cannot drift apart.
 *
 * Decorative by default, for uses that sit beside the priority's label. Pass
 * `labelled` where the icon stands alone — a task row — and it names itself to
 * screen readers and on hover instead.
 */
export function PriorityIcon({
  priority,
  labelled = false,
  className,
}: {
  priority: TaskPriority
  labelled?: boolean
  className?: string
}) {
  const count = CHEVRONS[priority]
  const top = (16 - (HEIGHT + STEP * (count - 1))) / 2
  const label = `${PRIORITY_META[priority].label} priority`

  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(labelled ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      className={cn('size-4 shrink-0', PRIORITY_META[priority].tone, className)}
    >
      {labelled && <title>{label}</title>}
      {Array.from({ length: count }, (_, index) => {
        const y = top + index * STEP
        return <path key={index} d={`M4 ${y + HEIGHT} L8 ${y} L12 ${y + HEIGHT}`} />
      })}
    </svg>
  )
}
