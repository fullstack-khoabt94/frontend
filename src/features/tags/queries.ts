import { useMemo } from 'react'
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/api/client'
import { taskKeys } from '@/features/tasks/queries'
import { tagsApi } from './api'
import type { Tag, TagFormValues, TagSearch } from './schemas'

export const tagKeys = {
  all: ['tags'] as const,
  list: () => [...tagKeys.all, 'list'] as const,
  detail: (id: string) => [...tagKeys.all, 'detail', id] as const,
}

/**
 * One cached fetch of every tag, shared by the management screen and by the
 * picker inside the task dialog.
 *
 * A single un-parameterised key is right here, unlike `taskKeys.list`: `GET
 * /tag/all` takes no parameters at all, so there is only ever one response to
 * cache. Searching is a client-side view over it — see {@link useTagList} — for
 * the same reason the board grid filters in the browser.
 */
export const tagListQuery = () =>
  queryOptions({
    queryKey: tagKeys.list(),
    queryFn: () => tagsApi.list(),
  })

export const tagDetailQuery = (id: string) =>
  queryOptions({
    queryKey: tagKeys.detail(id),
    queryFn: () => tagsApi.getById(id),
  })

/**
 * Every tag the signed-in user has, sorted by name.
 *
 * The order is the client's: `GET /tag/all` runs `findByUserId` with no
 * `Sort`, so Postgres is free to return the rows in any order it likes and will
 * change its mind as rows are updated. A library the user scans by eye has to
 * hold still, so it is sorted here — `localeCompare`, so accented names land
 * where a reader expects rather than after `z`.
 */
export function useTagList() {
  const query = useQuery(tagListQuery())

  const tags = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => a.title.localeCompare(b.title)),
    [query.data],
  )

  return { ...query, tags }
}

/** The management screen's view: {@link useTagList} narrowed by the URL's `?q=`. */
export function useTagSearch(search: TagSearch) {
  const query = useTagList()

  const tags = useMemo(() => {
    const needle = search.q.trim().toLocaleLowerCase()
    if (!needle) return query.tags
    return query.tags.filter(
      (tag) =>
        tag.title.toLocaleLowerCase().includes(needle) ||
        (tag.description ?? '').toLocaleLowerCase().includes(needle),
    )
  }, [query.tags, search.q])

  return { ...query, tags, total: query.tags.length }
}

export function useTag(id: string) {
  return useQuery(tagDetailQuery(id))
}

/**
 * Tags are embedded in `TaskResponse`, so a tag that changes name, colour or
 * existence changes every cached task row that carries it.
 *
 * There is no way to patch those rows in place — a cached page holds whole
 * `Task` objects — so both caches are invalidated together. Cheap: the tag list
 * is one small request and the task pages refetch only what is mounted.
 */
function invalidateTagsAndTasks(client: QueryClient) {
  void client.invalidateQueries({ queryKey: taskKeys.all })
  return client.invalidateQueries({ queryKey: tagKeys.all })
}

export function useCreateTag() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (values: TagFormValues) => tagsApi.create(values),
    onSuccess: (tag) => {
      // A brand new tag is on no task yet, so only the tag list can be stale.
      void client.invalidateQueries({ queryKey: tagKeys.all })
      toast.success('Tag created', { description: tag.title })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useUpdateTag() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TagFormValues }) =>
      tagsApi.update(id, values),
    onSuccess: (tag) => {
      void invalidateTagsAndTasks(client)
      toast.success('Tag updated', { description: tag.title })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

/**
 * A hard delete that also unlinks the tag from every task holding it — the
 * join rows go with it via `ON DELETE CASCADE`.
 *
 * Not optimistic, unlike `useArchiveBoard`. Removing the row from the list the
 * instant it is clicked would be easy, but the tag is also sitting on an unknown
 * number of cached task rows that only a refetch can correct, so a half-applied
 * optimistic state would be visibly inconsistent between two screens.
 */
export function useDeleteTag() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; title: string }) => tagsApi.remove(id),
    onSuccess: (_data, { title }) => {
      void invalidateTagsAndTasks(client)
      toast.success('Tag deleted', { description: title })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

/** Convenience for `useDeleteTag`'s variables, so callers pass a whole tag. */
export function toDeleteVariables(tag: Tag) {
  return { id: tag.id, title: tag.title }
}
