import { useMemo } from 'react'
import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/api/client'
import { tasksApi, type TaskListParams } from './api'
import { buildPageView } from './list'
import {
  taskToFormValues,
  type PagedTasks,
  type Task,
  type TaskFormValues,
  type TaskSearch,
  type TaskStatus,
} from './schemas'

export const taskKeys = {
  all: ['tasks'] as const,
  /**
   * `lists()` is the prefix every page of every board shares. It is what the
   * mutations invalidate and what the optimistic toggle writes through, so a
   * status change lands on whichever pages happen to be cached.
   */
  lists: () => [...taskKeys.all, 'list'] as const,
  /**
   * One entry per (board, page, size, sort). The cache is keyed by the request
   * now that the server does the scoping — the old single-array key could not
   * survive a paginated endpoint, since two pages of the same board are
   * genuinely different responses.
   */
  list: (params: TaskListParams) => [...taskKeys.lists(), params] as const,
}

export const taskListQuery = (params: TaskListParams) =>
  queryOptions({
    queryKey: taskKeys.list(params),
    queryFn: () => tasksApi.list(params),
    /**
     * Paging keeps the previous page on screen while the next one loads, so the
     * list does not collapse into skeletons and bounce the scroll position on
     * every click. `isPlaceholderData` is what the route dims the list with.
     */
    placeholderData: keepPreviousData,
  })

export function useTaskList(search: TaskSearch, boardId: string) {
  const params: TaskListParams = {
    boardId,
    page: search.page,
    size: search.size,
    sort: search.sort,
  }
  const query = useQuery(taskListQuery(params))
  const page = query.data

  const view = useMemo(() => buildPageView(page?.data ?? [], search), [page?.data, search])

  return {
    ...query,
    tasks: view.tasks,
    /** Page-scoped — see `features/tasks/list.ts`. */
    stats: page ? view.stats : undefined,
    /** Server-side totals, and the only counts on the screen that describe the whole board. */
    pageMeta: page
      ? {
          // Back to one-based, matching the URL.
          page: page.page + 1,
          size: page.size,
          total: page.total,
          totalPages: page.totalPages,
        }
      : undefined,
  }
}

function invalidateTasks(client: QueryClient) {
  return client.invalidateQueries({ queryKey: taskKeys.all })
}

/**
 * Every mutation takes the board it operates in, because the endpoints are
 * nested under `/board/{boardId}/task`. It is a hook argument rather than a
 * mutate variable for the same reason `useTaskList` takes one: the board is
 * route context, fixed for the lifetime of the screen, not a per-call choice.
 *
 * Deriving it from `task.boardId` instead would work today but reads the board
 * off a nullable response field, and a null there would build `/board//task/…`
 * — a 404 with no clue where it came from.
 */
export function useCreateTask(boardId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (values: TaskFormValues) => tasksApi.create(boardId, values),
    onSuccess: (task) => {
      void invalidateTasks(client)
      toast.success('Task created', { description: task.title })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useUpdateTask(boardId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TaskFormValues }) =>
      tasksApi.update(boardId, id, values),
    onSuccess: (task) => {
      void invalidateTasks(client)
      toast.success('Task updated', { description: task.title })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

/**
 * There is no status-only endpoint, so a toggle is a full PUT built from the
 * task we already hold. The cache is updated optimistically and rolled back on
 * failure, since this is the highest-frequency action in the app.
 *
 * It writes across **every** cached page rather than one key. Paging leaves
 * several pages of a board in the cache at once (that is the point of
 * `keepPreviousData`), and the row being toggled is only in one of them — but
 * which one is not worth deriving when a prefix match covers it.
 */
export function useUpdateTaskStatus(boardId: string) {
  const client = useQueryClient()
  const listFilter = { queryKey: taskKeys.lists() }

  return useMutation({
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) =>
      tasksApi.update(boardId, task.id, { ...taskToFormValues(task), status }),
    onMutate: async ({ task, status }) => {
      await client.cancelQueries(listFilter)
      const snapshot = client.getQueriesData<PagedTasks>(listFilter)
      client.setQueriesData<PagedTasks>(listFilter, (previous) =>
        previous
          ? {
              ...previous,
              data: previous.data.map((item) => (item.id === task.id ? { ...item, status } : item)),
            }
          : previous,
      )
      return { snapshot }
    },
    onError: (error, _variables, context) => {
      for (const [key, data] of context?.snapshot ?? []) {
        client.setQueryData(key, data)
      }
      toast.error(getApiErrorMessage(error))
    },
    onSuccess: (task) => {
      if (task.status === 'DONE')
        toast.success('Nice — task completed', { description: task.title })
    },
    onSettled: () => invalidateTasks(client),
  })
}

export function useDeleteTask(boardId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; title: string }) => tasksApi.remove(boardId, id),
    onSuccess: (_data, { title }) => {
      void invalidateTasks(client)
      toast.success('Task deleted', { description: title })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}
