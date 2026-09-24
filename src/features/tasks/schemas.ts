import { z } from 'zod'
import { tagSchema } from '@/features/tags/schemas'
import { htmlToPlainText } from '@/lib/rich-text'

/**
 * Enum casing mirrors the Java enums exactly (`TaskStatus`, `TaskPriority`).
 * Jackson serialises and deserialises them by `name()`, so the wire format is
 * SCREAMING_SNAKE_CASE in both directions.
 */
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const
export const taskStatusSchema = z.enum(TASK_STATUSES)
export type TaskStatus = z.infer<typeof taskStatusSchema>

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
export const taskPrioritySchema = z.enum(TASK_PRIORITIES)
export type TaskPriority = z.infer<typeof taskPrioritySchema>

/** Mirrors `TaskResponse` on the backend. */
export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  /** Serialised from a Java `LocalDateTime`, e.g. "2026-08-30T00:00:00" — no zone. */
  dueDate: z.string().nullable(),
  /**
   * The board this task belongs to.
   *
   * `TaskResponse` no longer carries `userId` at all — ownership moved to the
   * board, and a task reaches its owner through `task.board.user`. Nothing on
   * the client needs the owner directly, so nothing replaced it.
   *
   * Nullable on the way in even though the form requires it: `fromTask` calls
   * `task.getBoard().getId()` unguarded, so a null board is a server-side NPE
   * rather than a null here — but a task that predates the column would still
   * blank the whole list if the parse were strict, and showing it costs nothing.
   */
  boardId: z.string().nullable().catch(null),
  /**
   * `TaskResponse` now exposes both `BaseEntity` timestamps, which is what makes
   * ordering by age possible — `createdAt` is the backend's own default sort and
   * the only column in `ALLOWED_SORT` that is always populated.
   */
  createdAt: z.string(),
  updatedAt: z.string(),
  /**
   * The tags on this task, embedded in the response rather than fetched
   * separately — `TaskResponse` carries `Set<TagResponse>`.
   *
   * **A `Set` on the wire is a JSON array with no guaranteed order.** `Task.tags`
   * is a `@ManyToMany` `Set` with no `@OrderBy`, so the order is whatever the
   * join returns and it can differ between two reads of the same task. Anything
   * that renders these sorts them itself — see `sortTags`.
   *
   * Defaulted rather than required: a task created before tags existed, or one
   * whose `tags` came back `null`, must render with no chips rather than
   * failing the parse and blanking the whole page.
   */
  tags: z
    .array(tagSchema)
    .nullish()
    .catch(null)
    .default([])
    .transform((tags) => tags ?? []),
})
export type Task = z.infer<typeof taskSchema>

/**
 * Tags in a stable, readable order.
 *
 * The backend hands back an unordered `Set`, so without this the chips on a row
 * could reshuffle between two fetches of the same task — movement the reader
 * cannot explain. Sorted by name, matching the tag library's own order.
 */
export function sortTags<T extends { title: string }>(tags: T[]): T[] {
  return [...tags].sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * Mirrors `com.eazybytes.dtos.PagedResponse<T>`.
 *
 * `page` is **zero-based on the wire**, because it comes straight off Spring's
 * `Page#getNumber()`. Everything above `tasksApi` works in one-based pages, so
 * the conversion happens in exactly one place — see `api.ts`.
 */
export const pagedResponseSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    page: z.number().int(),
    size: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })

export const pagedTaskListSchema = pagedResponseSchema(taskSchema)
export type PagedTasks = z.infer<typeof pagedTaskListSchema>

/** Shape of the Add / Edit task form — mirrors CreateTaskDto / UpdateTaskDto. */
export const taskFormSchema = z.object({
  /**
   * Required on create, so every new task lands somewhere. Inside a board the
   * dialog fills it from the route and hides the field. The picker is only for a
   * screen that has no board in context, and there is none today.
   *
   * **This never reaches the wire.** Both task DTOs dropped `boardId` when the
   * routes nested under `/board/{boardId}/task`, so the board is now the path
   * `tasksApi` builds from the route — the field stays in the form only to drive
   * the picker's display.
   *
   * **It is still create-only.** `updateTask` reads the path board to authorise
   * the call and never reassigns `task.board`, so the picker is disabled when
   * editing — a task cannot change board.
   */
  boardId: z.string().min(1, 'Pick a board'),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(120, 'Keep the title under 120 characters'),
  // Required: the backend marks description @NotBlank on both create and update.
  // The value is HTML from the rich text editor, so limits apply to the visible
  // text — `<p></p>` is not a description, and tags do not count as characters.
  description: z
    .string()
    .refine((html) => htmlToPlainText(html).length > 0, 'Description is required')
    .refine(
      (html) => htmlToPlainText(html).length <= 1000,
      'Keep the description under 1000 characters',
    ),
  status: taskStatusSchema.default('TODO'),
  priority: taskPrioritySchema.default('MEDIUM'),
  // Any date, past ones included: an overdue task has to stay editable, and
  // the backend no longer insists on `@Future`.
  dueDate: z.string().optional(),
  /**
   * Whole tags, not ids.
   *
   * That is the backend's shape, not a convenience: `CreateTaskDto` and
   * `UpdateTaskDto` both declare `Set<Tag>` — the JPA **entity** — so the
   * payload has to carry objects Jackson can bind to one. `tasksApi` trims each
   * down to the fields that matter; see the note there, including what this
   * costs in ownership checking.
   *
   * Holding the objects here rather than ids also keeps the picker and the
   * chips rendering straight from form state, with no lookup against the tag
   * list on every keystroke.
   */
  tags: z.array(tagSchema).default([]),
})
export type TaskFormInput = z.input<typeof taskFormSchema>
export type TaskFormValues = z.output<typeof taskFormSchema>

/** Turns an existing task back into form values, for editing and status toggles. */
export function taskToFormValues(task: Task): TaskFormValues {
  return {
    boardId: task.boardId ?? '',
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : undefined,
    // Load-bearing for the status toggle: `useUpdateTaskStatus` rebuilds the
    // whole task from this, and a PUT is a full replace — dropping the tags
    // here would strip them off the task every time a checkbox is ticked.
    tags: task.tags,
  }
}

/**
 * The five list views the product requires.
 *
 * These are **server-side** now: `/board/{boardId}/task/all` takes `statuses`,
 * `priority` and `search` alongside `page`, `size` and `sort`, so a filter
 * narrows the whole board rather than the page that happened to be fetched.
 * See {@link FILTER_STATUSES} for how a tab becomes a query parameter.
 */
export const TASK_FILTERS = ['all', 'not_done', 'todo', 'in_progress', 'done'] as const
export const taskFilterSchema = z.enum(TASK_FILTERS)
export type TaskFilter = z.infer<typeof taskFilterSchema>

/**
 * Each tab as the `statuses` the backend expects.
 *
 * `QueryTasksDto.statuses` is a `List<TaskStatus>`, and `TaskSpecification`
 * skips the predicate entirely when the list is null or empty — which is what
 * makes `all` a plain `undefined` here rather than "every status spelled out".
 * Axios drops undefined params, so the "All tasks" tab sends no `statuses` at
 * all.
 *
 * `not_done` is the reason the parameter is a list and not a single value: it
 * is two statuses, and no single `?status=` could express it.
 */
export const FILTER_STATUSES: Record<TaskFilter, TaskStatus[] | undefined> = {
  all: undefined,
  not_done: ['TODO', 'IN_PROGRESS'],
  todo: ['TODO'],
  in_progress: ['IN_PROGRESS'],
  done: ['DONE'],
}

/**
 * Sorting is the server's job now, so every option here has to be one the
 * backend will actually honour.
 *
 * `TaskServiceImpl.ALLOWED_SORT` is `{createdAt, dueDate, priority}` and
 * `Sorts.sanitize` silently drops anything else, so an unsupported option would
 * not error — it would quietly fall back to `id DESC`, which is worse. Two of
 * the three old options are gone for exactly that reason:
 *
 * - **`title_asc`** is not in `ALLOWED_SORT`.
 * - **`priority_desc`** is, but `Task.priority` is `@Enumerated(STRING)`, so the
 *   database orders it alphabetically — `HIGH, LOW, MEDIUM`, not by urgency.
 *   Offering it would be offering a wrong answer.
 *
 * Bring either back the moment the backend can serve it: `title` added to
 * `ALLOWED_SORT`, and priority given a real ordinal to sort on.
 */
export const TASK_SORTS = ['created_desc', 'created_asc', 'due_asc', 'due_desc'] as const
export const taskSortSchema = z.enum(TASK_SORTS)
export type TaskSort = z.infer<typeof taskSortSchema>

/**
 * Wire format for Spring's `sort` parameter: `property,direction`.
 *
 * Note what `due_desc` does to tasks with no deadline. Postgres sorts NULLs
 * last ascending and first descending, and neither the query nor `Sorts` sets
 * an explicit `NULLS` clause — so "latest first" opens with every undated task.
 * That is the database's default showing through rather than a decision, and it
 * needs `NULLS LAST` on the backend to fix.
 */
export const TASK_SORT_PARAM: Record<TaskSort, string> = {
  created_desc: 'createdAt,desc',
  created_asc: 'createdAt,asc',
  due_asc: 'dueDate,asc',
  due_desc: 'dueDate,desc',
}

/** Matches `@PageableDefault(size = 20)` on `TaskController.getAllTask`. */
export const DEFAULT_PAGE_SIZE = 20
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

/**
 * Parsed from the URL — the task list is fully driven by search params, so a
 * page deep in a board is linkable and survives a refresh.
 *
 * `page` is **one-based here**, because it is what a person reads in the address
 * bar. `tasksApi.list` subtracts one for Spring.
 */
export const taskSearchSchema = z.object({
  /**
   * Defaults to `not_done` rather than `all`: opening a board is a question
   * about what is left to do, so the list arrives already narrowed to TODO and
   * IN_PROGRESS — `?filter=` absent or malformed both land there. The tabs still
   * switch it, and `?filter=all` remains a valid, linkable view.
   */
  filter: taskFilterSchema.catch('not_done').default('not_done'),
  q: z.string().trim().catch('').default(''),
  /**
   * Absent means "any priority". It stays optional rather than gaining an
   * `'ALL'` member so that the cleared state drops out of the URL instead of
   * sitting in it as `?priority=ALL`, and so it maps straight onto
   * `QueryTasksDto.priority`, which is a nullable single value.
   */
  priority: taskPrioritySchema.optional().catch(undefined),
  /**
   * A plain `yyyy-MM-dd` string, matching both the `<input type="date">` that
   * produces it and the Java `LocalDate` that receives it — no `Date` object in
   * between, so nothing can shift it across a timezone on the way.
   *
   * Validated by shape rather than parsed: a malformed `?dueOnOrBefore=` clears
   * itself here instead of reaching Spring, which would answer a bind error
   * rather than a list.
   */
  dueOnOrBefore: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  sort: taskSortSchema.catch('created_desc').default('created_desc'),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  size: z.coerce
    .number()
    .int()
    .refine((value) => PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]))
    .catch(DEFAULT_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
})
export type TaskSearch = z.output<typeof taskSearchSchema>

/**
 * One count per tab, for the summary cards and the tab badges.
 *
 * There is no aggregate endpoint, so these come from three `size=1` list calls
 * — one per status — read for their `total` alone. That is three small requests
 * instead of one, and the trade is that the numbers finally describe the whole
 * board rather than the twenty rows on screen. Replace `useTaskStats` with a
 * single call the moment `GET /board/{boardId}/stats` exists.
 */
export type TaskStats = Record<TaskFilter, number>
