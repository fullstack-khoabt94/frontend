import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import type { TaskStats } from '../schemas'

type Props = {
  /**
   * Board-wide counts from `useTaskStats`, not a tally of the rows on screen —
   * so completion covers the board, on page one or page four alike.
   */
  stats?: TaskStats
  /**
   * Set when a search term, a priority or a deadline is narrowing the board,
   * which these counts follow. The accessible label then says it describes the
   * matches.
   */
  isNarrowed?: boolean
}

/** Ring thickness; the mask below cuts the filled disc down to this. */
const RING = '4px'

/**
 * Hue at the start of the arc and at a full one. The arc is a conic gradient
 * from the first towards the second, stopping at the current percentage, so the
 * head of the arc warms from red through amber to green as the board fills.
 */
const HUE_START = 30
const HUE_END = 162

const arcColor = (percent: number) =>
  `oklch(0.7 0.16 ${HUE_START + ((HUE_END - HUE_START) * percent) / 100})`

/** The completion ring beside the board's title. */
export function TaskSummary({ stats, isNarrowed }: Props) {
  if (!stats) return <span className="size-11 shrink-0 animate-pulse rounded-full bg-muted" />

  const completion = stats.all > 0 ? Math.round((stats.done / stats.all) * 100) : 0
  const isComplete = completion === 100

  const style: CSSProperties = {
    background: isComplete
      ? 'var(--status-done)'
      : `conic-gradient(in oklch, ${arcColor(0)} 0%, ${arcColor(completion)} ${completion}%, var(--muted) ${completion}%)`,
    mask: `radial-gradient(farthest-side, transparent calc(100% - ${RING}), #000 calc(100% - ${RING}))`,
  }

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={completion}
      aria-label={isNarrowed ? 'Completion of matching tasks' : 'Board completion'}
      className="relative grid size-11 shrink-0 place-items-center"
    >
      <span aria-hidden className="absolute inset-0 rounded-full" style={style} />
      {isComplete ? (
        <Check aria-hidden className="size-5 text-status-done" strokeWidth={3} />
      ) : (
        <span aria-hidden className="text-[11px] font-semibold tabular-nums">
          {completion}%
        </span>
      )}
    </div>
  )
}
