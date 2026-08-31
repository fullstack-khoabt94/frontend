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
 * Mirrors `BoardResponse` exactly.
 *
 * **The label field is `title`, not `name`** — `BoardResponse` names it after the
 * column, and a board's title sits alongside a task's `title` consistently
 * enough that the client follows rather than translating at the boundary. A
 * hidden rename here would be invisible the next time the two are compared.
 *
 * `color` and `icon` are `.catch()`-guarded rather than strict: they are
 * presentation-only, so a value this build does not know about must degrade to
 * the default instead of failing the whole list parse and blanking the screen.
 * The backend defaults both to the literal string `'default'`, which is exactly
 * the case this guard absorbs.
 *
 * **The archived flag is read from `isArchived` *or* `archived`.** As built,
 * `BoardResponse` is a record with a `Boolean` component, so Jackson emits
 * `isArchived` and the first key hits. The fallback stays because the trap it
 * guards is real for any non-record DTO: a `boolean isArchived` field with an
 * `isArchived()` getter serialises as `archived`, since the bean introspector
 * strips the `is` prefix the way it strips `get`.
 */
export const boardSchema = z
  .object({
    id: z.string(),
    title: z.string(),
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

/**
 * Shape of the Add / Edit board form — mirrors CreateBoardDto / UpdateBoardDto.
 *
 * Two limits here are the backend's, not the designer's:
 *
 * - **Title caps at 50, not the DTO's 120.** `Board.title` is `varchar(50)`, so
 *   anything longer clears `@Size(max = 120)` and then fails on the insert with
 *   a 500. The form holds the tighter of the two so the error never happens.
 * - **Description is required.** Both board DTOs mark it `@NotBlank`, so an
 *   empty box is a 400. The client asks for it up front instead.
 *
 * `isArchived` is deliberately absent: `UpdateBoardDto` has no such field, so
 * the archived flag cannot travel on a form submit. Archiving is `DELETE`.
 */
export const boardFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Board title is required')
    .max(50, 'Keep the title under 50 characters'),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(500, 'Keep the description under 500 characters'),
  color: boardColorSchema.default(DEFAULT_BOARD_COLOR),
  icon: z.string().default(DEFAULT_BOARD_ICON),
})
export type BoardFormInput = z.input<typeof boardFormSchema>
export type BoardFormValues = z.output<typeof boardFormSchema>

/**
 * Archived boards are still returned by `GET /board/all`, so the grid needs two
 * views and both have to be linkable — the same reasoning that put the task
 * filters in the URL.
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
