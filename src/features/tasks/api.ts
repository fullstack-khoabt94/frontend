import { api } from '@/lib/api/client'
import { taskListSchema, taskSchema, type Task, type TaskFormValues } from './schemas'

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

export const tasksApi = {
  /**
   * Every task the caller owns, in one array.
   *
   * There is no board-scoped list endpoint. `TaskController` exposes only
   * `/task/all`, and `/board/{id}/task` does not exist — so a board's tasks are
   * filtered out of this one cached array in the browser, the same way the five
   * status filters already are. See `features/tasks/list.ts`.
   */
  async list(): Promise<Task[]> {
    const { data } = await api.get('/task/all')
    return taskListSchema.parse(data)
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
