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
 * Everything `GET /task/all` accepts. `boardId` is **required** by the
 * controller (`@RequestParam(required = true)`), which is why there is no
 * cross-board variant of this call and no default for it here.
 */
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
    const { data } = await api.get('/task/all', {
      params: { boardId, page: page - 1, size, sort: TASK_SORT_PARAM[sort] },
    })
    return pagedTaskListSchema.parse(data)
  },

  async getById(id: string): Promise<Task> {
    const { data } = await api.get(`/task/${id}`)
    return taskSchema.parse(data)
  },

  /** `CreateTaskDto` is the only one of the two that carries `boardId`. */
  async create(values: TaskFormValues): Promise<Task> {
    const { data } = await api.post('/task', { ...toPayload(values), boardId: values.boardId })
    return taskSchema.parse(data)
  },

  /**
   * Full replace — the backend exposes PUT, and UpdateTaskDto requires every
   * field.
   *
   * **`boardId` is deliberately not sent.** `UpdateTaskDto` has no such field
   * and `TaskServiceImpl.updateTask` never touches `task.board`, so a task
   * cannot change board. Sending it anyway would be ignored silently and would
   * read like a working feature.
   */
  async update(id: string, values: TaskFormValues): Promise<Task> {
    const { data } = await api.put(`/task/${id}`, toPayload(values))
    return taskSchema.parse(data)
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/task/${id}`)
  },
}
