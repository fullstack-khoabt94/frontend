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
})
export type Task = z.infer<typeof taskSchema>

/** `GET /task/all` returns a bare array — there is no envelope and no stats. */
export const taskListSchema = z.array(taskSchema)

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
   * dialog fills it from the route and hides the field; on /tasks it renders a
   * picker.
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
 * The five list views the product requires. These are client-side concepts —
 * `GET /task/all` takes no parameters — so they stay lowercase and readable in
 * the URL rather than following the Java enum casing.
 */
export const TASK_FILTERS = ['all', 'not_done', 'todo', 'in_progress', 'done'] as const
export const taskFilterSchema = z.enum(TASK_FILTERS)
export type TaskFilter = z.infer<typeof taskFilterSchema>

/**
 * `TaskResponse` carries no createdAt/updatedAt, so the list cannot be ordered
 * by age. Every option here is computable from the fields the API returns.
 */
export const TASK_SORTS = ['priority_desc', 'due_asc', 'title_asc'] as const
export const taskSortSchema = z.enum(TASK_SORTS)
export type TaskSort = z.infer<typeof taskSortSchema>

/** Parsed from the URL — the task list is fully driven by search params. */
export const taskSearchSchema = z.object({
  filter: taskFilterSchema.catch('all').default('all'),
  q: z.string().trim().catch('').default(''),
  sort: taskSortSchema.catch('priority_desc').default('priority_desc'),
})
export type TaskSearch = z.output<typeof taskSearchSchema>

export type TaskStats = Record<TaskFilter, number>
