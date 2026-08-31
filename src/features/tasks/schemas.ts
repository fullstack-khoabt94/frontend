import { z } from 'zod'

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
})
export type Task = z.infer<typeof taskSchema>

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

/**
 * The backend validates `dueDate` with `@Future`, and receives it as midnight
 * local time, so today itself is already in the past. Only tomorrow onwards
 * passes.
 */
export function isFutureDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return false
  return new Date(year, month - 1, day).getTime() > Date.now()
}

/** Earliest date the backend will accept, for the date input's `min` attribute. */
export function earliestDueDate() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toISOString().slice(0, 10)
}

/** Shape of the Add / Edit task form — mirrors CreateTaskDto / UpdateTaskDto. */
export const taskFormSchema = z.object({
  /**
   * Required on create, so every new task lands somewhere. Inside a board the
   * dialog fills it from the route and hides the field. The picker is only for a
   * screen that has no board in context, and there is none today.
   *
   * **It is create-only.** `UpdateTaskDto` has no `boardId`, so the picker is
   * disabled when editing — a task cannot change board.
   */
  boardId: z.string().min(1, 'Pick a board'),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(120, 'Keep the title under 120 characters'),
  // Required: the backend marks description @NotBlank on both create and update.
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(1000, 'Keep the description under 1000 characters'),
  status: taskStatusSchema.default('TODO'),
  priority: taskPrioritySchema.default('MEDIUM'),
  dueDate: z
    .string()
    .optional()
    .refine((value) => !value || isFutureDate(value), 'Due date must be in the future'),
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
  }
}

/**
 * The five list views the product requires.
 *
 * These stay **client-side**: `/task/all` accepts `boardId`, `page`, `size` and
 * `sort`, and nothing else — there is no `?status=` and no `?q=`. So the filter
 * and the search box narrow the page the server sent, not the whole board. See
 * `features/tasks/list.ts` for what that costs and `TaskPagination` for how the
 * UI says so.
 */
export const TASK_FILTERS = ['all', 'not_done', 'todo', 'in_progress', 'done'] as const
export const taskFilterSchema = z.enum(TASK_FILTERS)
export type TaskFilter = z.infer<typeof taskFilterSchema>

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
  filter: taskFilterSchema.catch('all').default('all'),
  q: z.string().trim().catch('').default(''),
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

export type TaskStats = Record<TaskFilter, number>
