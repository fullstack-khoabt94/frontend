import type { TagColor } from './schemas'

type TagColorMeta = {
  label: string
  /** The chip itself — soft fill, solid text, used everywhere a tag is shown. */
  chip: string
  /** Solid swatch for the colour picker. */
  swatch: string
  /** Small solid dot, for rows that name the tag in text rather than as a chip. */
  dot: string
}

/**
 * Every tag colour resolves through here — components never name a `--board-*`
 * token directly and never a hex, exactly as `BOARD_COLOR_META` and
 * `STATUS_META` work for boards and statuses.
 *
 * The tokens are the board palette's, reused rather than duplicated: see the
 * note on {@link TagColor}. If tags ever need a hue boards do not have, it is
 * declared in `index.css` as `--tag-*` and only this file changes.
 *
 * The `hover:` and `data-[state=on]:` repeats in `swatch` are load-bearing for
 * the same reason they are in `BOARD_COLOR_META`: the picker is a `ToggleGroup`,
 * and `toggleVariants` paints its own `hover:bg-muted` / `data-[state=on]:bg-muted`
 * under a variant the plain `bg-*` does not carry, so tailwind-merge keeps both
 * and the grey wins. Restating the colour under the same two variants holds it.
 */
export const TAG_COLOR_META: Record<TagColor, TagColorMeta> = {
  blue: {
    label: 'Blue',
    chip: 'bg-board-blue-soft text-board-blue',
    swatch: 'bg-board-blue hover:bg-board-blue data-[state=on]:bg-board-blue',
    dot: 'bg-board-blue',
  },
  emerald: {
    label: 'Emerald',
    chip: 'bg-board-emerald-soft text-board-emerald',
    swatch: 'bg-board-emerald hover:bg-board-emerald data-[state=on]:bg-board-emerald',
    dot: 'bg-board-emerald',
  },
  amber: {
    label: 'Amber',
    chip: 'bg-board-amber-soft text-board-amber',
    swatch: 'bg-board-amber hover:bg-board-amber data-[state=on]:bg-board-amber',
    dot: 'bg-board-amber',
  },
  rose: {
    label: 'Rose',
    chip: 'bg-board-rose-soft text-board-rose',
    swatch: 'bg-board-rose hover:bg-board-rose data-[state=on]:bg-board-rose',
    dot: 'bg-board-rose',
  },
  violet: {
    label: 'Violet',
    chip: 'bg-board-violet-soft text-board-violet',
    swatch: 'bg-board-violet hover:bg-board-violet data-[state=on]:bg-board-violet',
    dot: 'bg-board-violet',
  },
  slate: {
    label: 'Slate',
    chip: 'bg-board-slate-soft text-board-slate',
    swatch: 'bg-board-slate hover:bg-board-slate data-[state=on]:bg-board-slate',
    dot: 'bg-board-slate',
  },
}
