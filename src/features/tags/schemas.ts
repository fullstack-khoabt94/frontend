import { z } from 'zod'

/**
 * Tag accents, by name — the same discipline `BOARD_COLORS` follows: the hex
 * never crosses the wire, and `TAG_COLOR_META` is the only place that knows
 * which CSS token a name resolves to.
 *
 * The vocabulary is deliberately identical to the board palette and reuses the
 * `--board-*` tokens rather than declaring `--tag-*` twins of the same six
 * values. A tag chip and a board chip sit side by side on a task row, so one
 * palette is what keeps that row from reading as two design systems. They are
 * still separate enums: nothing stops tags gaining a colour boards do not have.
 */
export const TAG_COLORS = ['blue', 'emerald', 'amber', 'rose', 'violet', 'slate'] as const
export const tagColorSchema = z.enum(TAG_COLORS)
export type TagColor = z.infer<typeof tagColorSchema>

export const DEFAULT_TAG_COLOR: TagColor = 'blue'

/**
 * Mirrors `TagResponse` on the backend.
 *
 * `color` is `.catch()`-guarded rather than strict, for the same reason boards
 * guard theirs: `Tag.color` carries `@ColumnDefault("default")`, so a tag
 * created outside this UI arrives with the literal string `'default'`. That is
 * presentation only, and must degrade to the default swatch instead of failing
 * the parse and blanking the whole tag list.
 *
 * `description` is nullable on the way in even though the form requires it —
 * the column is plain `text` with no `NOT NULL`, so a row written before the
 * DTO's `@NotBlank` existed still parses.
 *
 * There is no `userId` here: `TagResponse` does not expose one. Ownership is
 * enforced server-side — `TagServiceImpl.getValidTag` compares the tag's owner
 * against the `@AuthenticationPrincipal` — so the client never needs to know
 * whose tag it is holding.
 */
export const tagSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  color: tagColorSchema.catch(DEFAULT_TAG_COLOR),
  /**
   * **Nullable, and not only in theory.** A tag nested inside a `TaskResponse`
   * comes back with both timestamps `null` from `POST /board/{id}/task`: the
   * objects in that response are the ones Jackson built from the request body,
   * which never carried timestamps, and `@ManyToMany` does not cascade, so
   * Hibernate never replaces them with the managed rows. A later `GET` of the
   * same task returns them populated.
   *
   * Typing these as required would therefore fail the parse on every
   * create-task response — the task would be saved and the client would still
   * throw. Anything rendering them handles `null`.
   */
  createdAt: z.string().nullable().catch(null),
  updatedAt: z.string().nullable().catch(null),
})
export type Tag = z.infer<typeof tagSchema>

/** `GET /tag/all` returns a bare array, matching `/board/all`. */
export const tagListSchema = z.array(tagSchema)

/**
 * Shape of the tag form — mirrors CreateTagDto / UpdateTagDto.
 *
 * Two of these limits are the backend's, not the designer's:
 *
 * - **Title caps at 50, not the DTO's 120.** `tags.title` is `varchar(50)`
 *   while both DTOs carry `@Size(max = 120)`, so a 60-character title clears
 *   validation and then dies on the insert as a `DataIntegrityViolation`. The
 *   form holds the tighter of the two so that mismatch is never reached. This
 *   is the same trap `boardFormSchema` documents.
 * - **Description is required.** Both tag DTOs mark it `@NotBlank`, so an empty
 *   box is a 400 rather than a tag with no description. Asking for it up front
 *   is better than explaining the rejection afterwards.
 *
 * Titles are unique per user, case-insensitively: V6 declares
 * `unique index user_title_index on tags (user_id, lower(title))`. That cannot
 * be checked here without the full list, so {@link isDuplicateTagTitle} does it
 * where the list is in hand, and the server still has the final say.
 */
export const tagFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Tag name is required')
    .max(50, 'Keep the name under 50 characters'),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(500, 'Keep the description under 500 characters'),
  color: tagColorSchema.default(DEFAULT_TAG_COLOR),
})
export type TagFormInput = z.input<typeof tagFormSchema>
export type TagFormValues = z.output<typeof tagFormSchema>

/**
 * Whether `title` already belongs to another tag, matching the database's
 * `lower(title)` index.
 *
 * Client-side pre-emption of a constraint the server enforces anyway. It exists
 * because the rejection is otherwise opaque: the backend's
 * `DataIntegrityViolationException` handler returns `ex.getMessage()` verbatim,
 * which is the raw Postgres text naming the index and the offending key — not
 * something to put in a toast. Catching it here turns that into a field error
 * on the input that caused it.
 *
 * `excludeId` is what lets an edit keep its own name: without it, saving a tag
 * without touching the title would report the tag as a duplicate of itself.
 */
export function isDuplicateTagTitle(tags: Tag[], title: string, excludeId?: string) {
  const candidate = title.trim().toLocaleLowerCase()
  return tags.some(
    (tag) => tag.id !== excludeId && tag.title.trim().toLocaleLowerCase() === candidate,
  )
}

/** Parsed from the URL, so a filtered view of the tag library is linkable. */
export const tagSearchSchema = z.object({
  q: z.string().trim().catch('').default(''),
})
export type TagSearch = z.output<typeof tagSearchSchema>
