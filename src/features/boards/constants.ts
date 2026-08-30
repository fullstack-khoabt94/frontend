import type { BoardColor, BoardView } from './schemas'

type BoardColorMeta = {
  label: string
  /** Accent rail across the top of a board card. */
  rail: string
  /** Soft tile behind the board's emoji. */
  tile: string
  /** Solid swatch for the colour picker. */
  swatch: string
  /** Progress bar fill. */
  bar: string
}

/**
 * Every board colour resolves through here — components never name a
 * `--board-*` token directly, and never a hex, exactly as `STATUS_META` does
 * for task statuses.
 */
export const BOARD_COLOR_META: Record<BoardColor, BoardColorMeta> = {
  blue: {
    label: 'Blue',
    rail: 'bg-board-blue',
    tile: 'bg-board-blue-soft text-board-blue',
    swatch: 'bg-board-blue',
    bar: 'bg-board-blue',
  },
  emerald: {
    label: 'Emerald',
    rail: 'bg-board-emerald',
    tile: 'bg-board-emerald-soft text-board-emerald',
    swatch: 'bg-board-emerald',
    bar: 'bg-board-emerald',
  },
  amber: {
    label: 'Amber',
    rail: 'bg-board-amber',
    tile: 'bg-board-amber-soft text-board-amber',
    swatch: 'bg-board-amber',
    bar: 'bg-board-amber',
  },
  rose: {
    label: 'Rose',
    rail: 'bg-board-rose',
    tile: 'bg-board-rose-soft text-board-rose',
    swatch: 'bg-board-rose',
    bar: 'bg-board-rose',
  },
  violet: {
    label: 'Violet',
    rail: 'bg-board-violet',
    tile: 'bg-board-violet-soft text-board-violet',
    swatch: 'bg-board-violet',
    bar: 'bg-board-violet',
  },
  slate: {
    label: 'Slate',
    rail: 'bg-board-slate',
    tile: 'bg-board-slate-soft text-board-slate',
    swatch: 'bg-board-slate',
    bar: 'bg-board-slate',
  },
}

export const BOARD_VIEW_META: Record<BoardView, { label: string; description: string }> = {
  active: { label: 'Active', description: 'Boards you are working in.' },
  archived: { label: 'Archived', description: 'Put away, but not deleted.' },
}
