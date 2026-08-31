import { api } from '@/lib/api/client'
import { boardListSchema, boardSchema, type Board, type BoardFormValues } from './schemas'

/**
 * Paths follow the `/task` convention — singular resource, `/all` for the
 * collection.
 *
 * `CreateBoardDto` carries no owner: `BoardController` reads it off the
 * `@AuthenticationPrincipal`, unlike `tasksApi.create`, which still sends one.
 * Nothing here looks at `sessionStore`.
 */
function toPayload(values: BoardFormValues) {
  return {
    title: values.title,
    description: values.description,
    color: values.color,
    icon: values.icon,
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
    const { data } = await api.post('/board', toPayload(values))
    return boardSchema.parse(data)
  },

  /** Full replace. `UpdateBoardDto` has no `isArchived`, so this cannot archive. */
  async update(id: string, values: BoardFormValues): Promise<Board> {
    const { data } = await api.put(`/board/${id}`, toPayload(values))
    return boardSchema.parse(data)
  },

  /**
   * Archive, not delete.
   *
   * `BoardServiceImpl.deleteBoard` is a soft delete — it flips `isArchived` and
   * leaves the row and every task under it in place. There is no hard-delete
   * endpoint, so the UI does not offer one, and there is no endpoint that sets
   * the flag back either, so there is no restore.
   *
   * The response body is a plain-text `"Done"`; the client ignores it.
   */
  async archive(id: string): Promise<void> {
    await api.delete(`/board/${id}`)
  },
}
