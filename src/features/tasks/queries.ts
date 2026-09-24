import { useRef } from 'react'
import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/api/client'
import { tasksApi, type TaskCountParams, type TaskListParams } from './api'
import {
  taskToFormValues,
  TASK_STATUSES,
  type PagedTasks,
  type Task,
  type TaskFormValues,
  type TaskPriority,
  type TaskSearch,
  type TaskStats,
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
   * One entry per (board, page, size, sort, filter, search, priority). The cache
   * is keyed by the whole request now that the server does the scoping — the old
   * single-array key could not survive a paginated endpoint, since two pages of
   * the same board are genuinely different responses, and the same is true of
   * two filters.
   */
  list: (params: TaskListParams) => [...taskKeys.lists(), params] as const,
  /**
   * The badge counts, kept off `lists()` on purpose: the optimistic status
   * toggle rewrites every cached `PagedTasks` under that prefix, and a count is
   * a bare number. Both still sit under `all`, so one invalidation refreshes
   * the rows and the numbers together.
   */
  counts: () => [...taskKeys.all, 'count'] as const,
  count: (params: TaskCountParams) => [...taskKeys.counts(), params] as const,
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

export const taskCountQuery = (params: TaskCountParams) =>
  queryOptions({
    queryKey: taskKeys.count(params),
    queryFn: () => tasksApi.count(params),
    placeholderData: keepPreviousData,
  })

/**
 * The per-tab counts, from the database rather than from the rows on screen.
 *
 * Three requests, one per status, because the API has no aggregate endpoint —
 * see {@link TaskStats}. `all` and `not_done` are sums rather than two more
 * calls, which is exact: the three statuses are the whole enum, so nothing can
 * fall outside them.
 *
 * `combine` runs inside React Query, so the returned object is memoised across
 * renders even though `useQueries` hands back a fresh array each time.
 */
export function useTaskStats(
  boardId: string,
  q: string,
  priority?: TaskPriority,
  dueOnOrBefore?: string,
  tags?: string[],
) {
  return useQueries({
    queries: TASK_STATUSES.map((status) =>
      taskCountQuery({ boardId, status, q, priority, dueOnOrBefore, tags }),
    ),
    combine: (results): TaskStats | undefined => {
      // All three or none: a half-filled summary that settles one card at a
      // time reads as numbers changing under the reader.
      if (results.some((result) => result.data === undefined)) return undefined
      const [todo, inProgress, done] = results.map((result) => result.data as number)
      return {
        todo,
        in_progress: inProgress,
        done,
        not_done: todo + inProgress,
        all: todo + inProgress + done,
      }
    },
  })
}

export function useTaskList(search: TaskSearch, boardId: string) {
  const params: TaskListParams = {
    boardId,
    page: search.page,
    size: search.size,
    sort: search.sort,
    filter: search.filter,
    q: search.q,
    priority: search.priority,
    dueOnOrBefore: search.dueOnOrBefore,
    tags: search.tags,
  }
  const query = useQuery(taskListQuery(params))
  const page = query.data

  return {
    ...query,
    /**
     * Straight from the server. Nothing filters, searches or reorders these
     * rows on the way through any more — the endpoint did all three, and doing
     * it again here could only disagree with the pagination walking over it.
     */
    tasks: page?.data ?? [],
    /**
     * Totals for the **current view**, not the board: `total` counts every task
     * matching the active filter, search and priority, across all pages.
     */
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
/** How long a re-statused row stays put before the list is refetched. */
const STATUS_REFETCH_DELAY_MS = 5000

export function useUpdateTaskStatus(boardId: string) {
  const client = useQueryClient()
  const listFilter = { queryKey: taskKeys.lists() }
  const refetchTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

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
      // The rollback is a guess at the old state; resync with the server now.
      void invalidateTasks(client)
    },
    onSuccess: (task) => {
      if (task.status === 'DONE')
        toast.success('Nice — task completed', { description: task.title })
      /**
       * The tab counts refresh now; the rows wait. Refetching at once would pull
       * a task out from under the pointer the moment it leaves the active tab
       * (a "To do" row set to Done), before the change has registered — so the
       * row stays, showing its new status, for a few seconds first.
       *
       * One shared timer, restarted on every change: re-statusing a run of
       * tasks refetches once, after the last, instead of reshuffling the list
       * between clicks. It is not cleared on unmount — a refetch after leaving
       * is harmless, and skipping it would leave the cache stale.
       */
      void client.invalidateQueries({ queryKey: taskKeys.counts() })
      clearTimeout(refetchTimer.current)
      refetchTimer.current = setTimeout(
        () => void client.invalidateQueries(listFilter),
        STATUS_REFETCH_DELAY_MS,
      )
    },
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
