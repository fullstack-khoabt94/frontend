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
import { tasksApi } from './api'
import { buildListView } from './list'
import {
  taskToFormValues,
  type Task,
  type TaskFormValues,
  type TaskSearch,
  type TaskStatus,
} from './schemas'

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  /**
   * One entry per board, plus `null` for the cross-board list behind /tasks.
   * The board id is part of the key because the two lists come from different
   * endpoints and must not overwrite each other in the cache.
   */
  list: (boardId: string | null) => [...taskKeys.lists(), boardId] as const,
}

/** One cached fetch per board; filter / search / sort are derived in the browser. */
export const taskListQuery = (boardId: string | null) =>
  queryOptions({
    queryKey: taskKeys.list(boardId),
    queryFn: () => tasksApi.list(boardId),
  })

export function useTaskList(search: TaskSearch, boardId: string | null) {
  const query = useQuery(taskListQuery(boardId))
  const view = useMemo(() => buildListView(query.data ?? [], search), [query.data, search])

  return { ...query, tasks: view.tasks, stats: query.data ? view.stats : undefined }
}

/**
 * Every task list, not just the one on screen. A task can be created into, or
 * moved between, boards, which leaves two board lists *and* the cross-board one
 * stale — so the blunt invalidation is the correct one.
 */
function invalidateTasks(client: QueryClient) {
  return client.invalidateQueries({ queryKey: taskKeys.all })
}

export function useCreateTask() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (values: TaskFormValues) => tasksApi.create(values),
    onSuccess: (task) => {
      void invalidateTasks(client)
      toast.success('Task created', { description: task.title })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useUpdateTask() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TaskFormValues }) =>
      tasksApi.update(id, values),
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
 */
export function useUpdateTaskStatus(boardId: string | null) {
  const client = useQueryClient()
  const listKey = taskKeys.list(boardId)

  return useMutation({
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) =>
      tasksApi.update(task.id, { ...taskToFormValues(task), status }),
    onMutate: async ({ task, status }) => {
      await client.cancelQueries({ queryKey: listKey })
      const snapshot = client.getQueryData<Task[]>(listKey)
      client.setQueryData<Task[]>(listKey, (previous) =>
        previous?.map((item) => (item.id === task.id ? { ...item, status } : item)),
      )
      return { snapshot }
    },
    onError: (error, _variables, context) => {
      client.setQueryData(listKey, context?.snapshot)
      toast.error(getApiErrorMessage(error))
    },
    onSuccess: (task) => {
      if (task.status === 'DONE')
        toast.success('Nice — task completed', { description: task.title })
    },
    onSettled: () => invalidateTasks(client),
  })
}

export function useDeleteTask() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; title: string }) => tasksApi.remove(id),
    onSuccess: (_data, { title }) => {
      void invalidateTasks(client)
      toast.success('Task deleted', { description: title })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}
