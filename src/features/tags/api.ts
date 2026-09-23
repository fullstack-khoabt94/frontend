import { api } from '@/lib/api/client'
import { tagListSchema, tagSchema, type Tag, type TagFormValues } from './schemas'

/**
 * Singular resource, `/all` for the collection — the same convention boards
 * follow at `/board`, and tasks one level down at `/board/{boardId}/task`.
 *
 * Tags are **not** nested under a board. `Tag.user` points straight at the
 * owner, so a tag is shared across every board that user has, and
 * `TagController` reads the owner off the `@AuthenticationPrincipal` — nothing
 * here sends a `userId` or touches `sessionStore`.
 *
 * That is also the one cross-cutting risk worth knowing about: because tags are
 * user-scoped while tasks are board-scoped, the database cannot express "this
 * tag belongs to the same person as this task", and the backend does not check
 * it either. See the note on `tasksApi`'s tag payload.
 */
function toPayload(values: TagFormValues) {
  return {
    title: values.title,
    description: values.description,
    color: values.color,
  }
}

export const tagsApi = {
  async list(): Promise<Tag[]> {
    const { data } = await api.get('/tag/all')
    return tagListSchema.parse(data)
  },

  async getById(id: string): Promise<Tag> {
    const { data } = await api.get(`/tag/${id}`)
    return tagSchema.parse(data)
  },

  async create(values: TagFormValues): Promise<Tag> {
    const { data } = await api.post('/tag', toPayload(values))
    return tagSchema.parse(data)
  },

  /** Full replace. `UpdateTagDto` requires every field, like the other two modules. */
  async update(id: string, values: TagFormValues): Promise<Tag> {
    const { data } = await api.put(`/tag/${id}`, toPayload(values))
    return tagSchema.parse(data)
  },

  /**
   * A **hard** delete, unlike boards.
   *
   * `TagServiceImpl.deleteTag` calls `tagRepository.delete` — there is no
   * `isArchived` on tags and nothing to flip. The row goes, and every
   * `task_tags` row referencing it goes with it, because V6 declares the join's
   * foreign keys `ON DELETE CASCADE`. So deleting a tag silently unlinks it from
   * every task that carried it, which is why `DeleteTagDialog` says so out loud.
   *
   * The response body is a plain-text `"Done"`; the client ignores it.
   */
  async remove(id: string): Promise<void> {
    await api.delete(`/tag/${id}`)
  },
}
