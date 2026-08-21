import { z } from 'zod'

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const
export const taskStatusSchema = z.enum(TASK_STATUSES)
export type TaskStatus = z.infer<typeof taskStatusSchema>

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const
export const taskPrioritySchema = z.enum(TASK_PRIORITIES)
export type TaskPriority = z.infer<typeof taskPrioritySchema>

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Task = z.infer<typeof taskSchema>

/** Shape of the Add / Edit task form. */
export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(120, 'Keep the title under 120 characters'),
  description: z.string().trim().max(1000, 'Keep the description under 1000 characters').optional(),
  status: taskStatusSchema.default('todo'),
  priority: taskPrioritySchema.default('medium'),
  dueDate: z.string().optional(),
})
export type TaskFormInput = z.input<typeof taskFormSchema>
export type TaskFormValues = z.output<typeof taskFormSchema>

/**
 * The five list views the product requires. `not_done` is a server-side
 * composite of `todo` + `in_progress`.
 */
export const TASK_FILTERS = ['all', 'not_done', 'todo', 'in_progress', 'done'] as const
export const taskFilterSchema = z.enum(TASK_FILTERS)
export type TaskFilter = z.infer<typeof taskFilterSchema>

export const TASK_SORTS = ['created_desc', 'created_asc', 'due_asc', 'priority_desc'] as const
export const taskSortSchema = z.enum(TASK_SORTS)
export type TaskSort = z.infer<typeof taskSortSchema>

/** Parsed from the URL — the task list is fully driven by search params. */
export const taskSearchSchema = z.object({
  filter: taskFilterSchema.catch('all').default('all'),
  q: z.string().trim().catch('').default(''),
  sort: taskSortSchema.catch('created_desc').default('created_desc'),
})
export type TaskSearch = z.output<typeof taskSearchSchema>

export type TaskStats = Record<TaskFilter, number>

export const taskListResponseSchema = z.object({
  data: z.array(taskSchema),
  stats: z.object({
    all: z.number(),
    not_done: z.number(),
    todo: z.number(),
    in_progress: z.number(),
    done: z.number(),
  }),
})
export type TaskListResponse = z.infer<typeof taskListResponseSchema>
