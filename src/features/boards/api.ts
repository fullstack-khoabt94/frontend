import { api } from '@/lib/api/client'
import { sessionStore } from '@/features/auth/session'
import { boardListSchema, boardSchema, type Board, type BoardFormValues } from './schemas'

/**
 * Paths follow the `/task` convention exactly — singular resource, `/all` for
 * the collection — so the two features read the same way on the backend.
 */
function toPayload(values: BoardFormValues) {
  return {
    name: values.name,
    // The column is nullable; an empty box means "no description", not "".
    description: values.description?.trim() ? values.description : null,
    color: values.color,
    icon: values.icon,
    isArchived: values.isArchived,
  }
}

export const boardsApi = {
  async list(): Promise<Board[]> {
    const { data } = await api.get('/board/all')
    return boardListSchema.parse(data)
  },

  async getById(id: string): Promise<Board> {
    const { data } = await api.get(`/board/${id}`)
    return boardSchema.parse(data)
  },

  async create(values: BoardFormValues): Promise<Board> {
    // Mirrors `tasksApi.create`: the owner is sent explicitly until the backend
    // reads it off the authenticated principal.
    const userId = sessionStore.getState().user?.id
    const { data } = await api.post('/board', { ...toPayload(values), userId })
    return boardSchema.parse(data)
  },

  /** Full replace, like `PUT /task/{id}` — UpdateBoardDto is expected to require every field. */
  async update(id: string, values: BoardFormValues): Promise<Board> {
    const { data } = await api.put(`/board/${id}`, toPayload(values))
    return boardSchema.parse(data)
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/board/${id}`)
  },
}
