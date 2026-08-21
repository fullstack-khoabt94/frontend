import { api } from '@/lib/api/client'
import {
  taskListResponseSchema,
  taskSchema,
  type Task,
  type TaskFormValues,
  type TaskListResponse,
  type TaskSearch,
  type TaskStatus,
} from './schemas'

function toPayload(values: TaskFormValues) {
  return {
    title: values.title,
    description: values.description?.trim() ? values.description.trim() : null,
    status: values.status,
    priority: values.priority,
    dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
  }
}

export const tasksApi = {
  async list(search: TaskSearch): Promise<TaskListResponse> {
    const { data } = await api.get('/tasks', {
      params: { filter: search.filter, q: search.q || undefined, sort: search.sort },
    })
    return taskListResponseSchema.parse(data)
  },

  async create(values: TaskFormValues): Promise<Task> {
    const { data } = await api.post('/tasks', toPayload(values))
    return taskSchema.parse(data)
  },

  async update(id: string, values: TaskFormValues): Promise<Task> {
    const { data } = await api.patch(`/tasks/${id}`, toPayload(values))
    return taskSchema.parse(data)
  },

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    const { data } = await api.patch(`/tasks/${id}/status`, { status })
    return taskSchema.parse(data)
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`)
  },
}
