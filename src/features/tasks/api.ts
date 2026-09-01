import { api } from '@/lib/api/client'
import {
  pagedTaskListSchema,
  taskSchema,
  TASK_SORT_PARAM,
  type PagedTasks,
  type Task,
  type TaskFormValues,
  type TaskSort,
} from './schemas'

/**
 * The backend maps `dueDate` to a Java `LocalDateTime`, whose default Jackson
 * deserialiser is ISO_LOCAL_DATE_TIME — a trailing `Z` fails to parse. So the
 * date input's "yyyy-MM-dd" becomes a zone-less local timestamp, not an
 * `Instant`-style UTC string.
 */
function toLocalDateTime(date: string | undefined) {
  return date ? `${date}T00:00:00` : null
}

/** Fields common to CreateTaskDto and UpdateTaskDto. */
function toPayload(values: TaskFormValues) {
  return {
    title: values.title,
    description: values.description,
    status: values.status,
    priority: values.priority,
    dueDate: toLocalDateTime(values.dueDate),
  }
}

/**
 * Tasks are a **nested resource**: every route is `/board/{boardId}/task/…`, so
 * the board is a path segment on all five calls rather than a query parameter
 * or a body field.
 *
 * That is what enforces ownership. `TaskServiceImpl.getValidTask` checks two
 * things — the caller owns `{boardId}`, and `{taskId}` belongs to that same
 * board — so a task can only be reached through the board that holds it. There
 * is no un-scoped `/task/{id}` to fall back to.
 */
function taskPath(boardId: string, taskId?: string) {
  return taskId ? `/board/${boardId}/task/${taskId}` : `/board/${boardId}/task`
}

/** Everything the list endpoint accepts. `boardId` is the path, not a param. */
export type TaskListParams = {
  boardId: string
  /** One-based, as it appears in the URL. Converted for Spring below. */
  page: number
  size: number
  sort: TaskSort
}

export const tasksApi = {
  /**
   * One page of a board's tasks.
   *
   * Two translations happen here and nowhere else: the one-based page the URL
   * carries becomes Spring's zero-based `page`, and the client's sort id becomes
   * a `property,direction` pair the `PageableHandlerMethodArgumentResolver`
   * understands.
   */
  async list({ boardId, page, size, sort }: TaskListParams): Promise<PagedTasks> {
    const { data } = await api.get(`${taskPath(boardId)}/all`, {
      params: { page: page - 1, size, sort: TASK_SORT_PARAM[sort] },
    })
    return pagedTaskListSchema.parse(data)
  },

  async getById(boardId: string, id: string): Promise<Task> {
    const { data } = await api.get(taskPath(boardId, id))
    return taskSchema.parse(data)
  },

  /**
   * **`boardId` is not in the body.** `CreateTaskDto` dropped the field when the
   * routes nested — the board comes off the path and is authorised there, so a
   * body field would be a second, unchecked source of the same fact.
   */
  async create(boardId: string, values: TaskFormValues): Promise<Task> {
    const { data } = await api.post(taskPath(boardId), toPayload(values))
    return taskSchema.parse(data)
  },

  /**
   * Full replace — the backend exposes PUT, and UpdateTaskDto requires every
   * field.
   *
   * A task still **cannot change board**: `updateTask` reads `{boardId}` only to
   * authorise the call and never reassigns `task.board`, so the path board must
   * be the one the task is already in — any other value fails the ownership
   * check with a 404 rather than moving the task.
   */
  async update(boardId: string, id: string, values: TaskFormValues): Promise<Task> {
    const { data } = await api.put(taskPath(boardId, id), toPayload(values))
    return taskSchema.parse(data)
  },

  async remove(boardId: string, id: string): Promise<void> {
    await api.delete(taskPath(boardId, id))
  },
}
