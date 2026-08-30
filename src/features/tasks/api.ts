import { api } from '@/lib/api/client'
import { sessionStore } from '@/features/auth/session'
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

function toPayload(values: TaskFormValues) {
  return {
    title: values.title,
    description: values.description,
    status: values.status,
    priority: values.priority,
    dueDate: toLocalDateTime(values.dueDate),
    // A legacy task with no board round-trips as null rather than "", so a
    // plain status toggle on one does not fail the backend's UUID binding.
    boardId: values.boardId || null,
  }
}

export const tasksApi = {
  /**
   * `boardId` scopes the list to one board; `null` is the cross-board view
   * behind /tasks.
   *
   * The board-scoped path is nested (`/board/{id}/task`) rather than
   * `/task/all?boardId=`, so ownership of the board can be checked once, on the
   * path, instead of trusting a query parameter.
   */
  async list(boardId: string | null): Promise<Task[]> {
    const { data } = await api.get(boardId ? `/board/${boardId}/task` : '/task/all')
    return taskListSchema.parse(data)
  },

  async getById(id: string): Promise<Task> {
    const { data } = await api.get(`/task/${id}`)
    return taskSchema.parse(data)
  },

  async create(values: TaskFormValues): Promise<Task> {
    // CreateTaskDto carries the owner explicitly. Once the backend reads it from
    // the authenticated principal, drop this field and the session lookup.
    const userId = sessionStore.getState().user?.id
    const { data } = await api.post('/task', { ...toPayload(values), userId })
    return taskSchema.parse(data)
  },

  /** Full replace — the backend exposes PUT, and UpdateTaskDto requires every field. */
  async update(id: string, values: TaskFormValues): Promise<Task> {
    const { data } = await api.put(`/task/${id}`, toPayload(values))
    return taskSchema.parse(data)
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/task/${id}`)
  },
}
