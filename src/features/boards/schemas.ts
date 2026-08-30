import { z } from 'zod'

/**
 * Board accents. These are *names*, not colours — the hex never crosses the
 * wire and never reaches a component. `BOARD_COLOR_META` maps each name onto
 * the `--board-*` tokens declared in `index.css`, so the palette stays in one
 * place and light/dark are defined together.
 *
 * Stored as a plain string on the backend; the client owns the vocabulary.
 */
export const BOARD_COLORS = ['blue', 'emerald', 'amber', 'rose', 'violet', 'slate'] as const
export const boardColorSchema = z.enum(BOARD_COLORS)
export type BoardColor = z.infer<typeof boardColorSchema>

export const DEFAULT_BOARD_COLOR: BoardColor = 'blue'

/** Emoji offered by the picker. Any single character the backend returns still renders. */
export const BOARD_ICONS = [
  '📋',
  '🚀',
  '🎯',
  '💼',
  '🏠',
  '💡',
  '🐛',
  '📚',
  '🎨',
  '🛠️',
  '📈',
  '🔥',
] as const

export const DEFAULT_BOARD_ICON = '📋'

/**
 * Mirrors the `BoardResponse` the backend needs to return.
 *
 * `color` and `icon` are `.catch()`-guarded rather than strict: they are
 * presentation-only, so a value this build does not know about must degrade to
 * the default instead of failing the whole list parse and blanking the screen.
 *
 * **The archived flag is read from `isArchived` *or* `archived`.** This is not
 * defensiveness for its own sake — it is a specific Jackson behaviour worth
 * absorbing here. A Java `private boolean isArchived` with the getter
 * `isArchived()` serialises as `"archived"`, not `"isArchived"`, because the
 * bean introspector strips the `is` prefix the same way it strips `get`. So the
 * field name and the wire name differ unless the DTO carries an explicit
 * `@JsonProperty("isArchived")`. Accepting both means the screen works whichever
 * way the DTO ends up being written.
 */
export const boardSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    color: boardColorSchema.catch(DEFAULT_BOARD_COLOR),
    icon: z.string().nullable().catch(null),
    userId: z.string(),
    isArchived: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .transform(({ isArchived, archived, ...board }) => ({
    ...board,
    // Absent means live: a backend that has not shipped the column yet keeps
    // showing every board rather than hiding all of them.
    isArchived: isArchived ?? archived ?? false,
  }))
export type Board = z.infer<typeof boardSchema>

/** `GET /board/all` returns a bare array, matching `GET /task/all`. */
export const boardListSchema = z.array(boardSchema)

/** Shape of the Add / Edit board form — mirrors CreateBoardDto / UpdateBoardDto. */
export const boardFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Board name is required')
    .max(80, 'Keep the name under 80 characters'),
  // Optional, unlike a task's description: a board is a container, and forcing a
  // sentence out of someone before they can group two tasks is friction for
  // nothing. The backend must accept null here — do not mark it @NotBlank.
  description: z.string().trim().max(500, 'Keep the description under 500 characters').optional(),
  color: boardColorSchema.default(DEFAULT_BOARD_COLOR),
  icon: z.string().default(DEFAULT_BOARD_ICON),
  // Carried through the form so `UpdateBoardDto` can stay a full replace, like
  // `UpdateTaskDto`. The dialog never renders it — archiving is its own action.
  isArchived: z.boolean().default(false),
})
export type BoardFormInput = z.input<typeof boardFormSchema>
export type BoardFormValues = z.output<typeof boardFormSchema>

/** Turns an existing board back into form values, for editing and archive toggles. */
export function boardToFormValues(board: Board): BoardFormValues {
  return {
    name: board.name,
    description: board.description ?? undefined,
    color: board.color,
    icon: board.icon ?? DEFAULT_BOARD_ICON,
    isArchived: board.isArchived,
  }
}

/**
 * Archived boards are hidden rather than gone, so the grid needs two views and
 * both have to be linkable — the same reasoning that put the task filters in
 * the URL.
 */
export const BOARD_VIEWS = ['active', 'archived'] as const
export const boardViewSchema = z.enum(BOARD_VIEWS)
export type BoardView = z.infer<typeof boardViewSchema>

/** Parsed from the URL — the board grid is driven by search params, like /tasks. */
export const boardSearchSchema = z.object({
  view: boardViewSchema.catch('active').default('active'),
  q: z.string().trim().catch('').default(''),
})
export type BoardSearch = z.output<typeof boardSearchSchema>

/** Per-board task counts, derived in the browser. See `features/boards/list.ts`. */
export type BoardProgress = {
  total: number
  done: number
  /** 0–100, rounded. `0` when the board is empty. */
  completion: number
}
