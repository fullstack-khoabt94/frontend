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
import type { Task, TaskFormValues, TaskListResponse, TaskSearch, TaskStatus } from './schemas'

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (search: TaskSearch) => [...taskKeys.lists(), search] as const,
}

export const taskListQuery = (search: TaskSearch) =>
  queryOptions({
    queryKey: taskKeys.list(search),
    queryFn: () => tasksApi.list(search),
    placeholderData: (previous) => previous,
  })

export function useTaskList(search: TaskSearch) {
  return useQuery(taskListQuery(search))
}

/** Every mutation refreshes all list variants, since filters/stats shift together. */
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
    mutationFn: ({ id, values }: { id: string; values: TaskFormValues }) => tasksApi.update(id, values),
    onSuccess: (task) => {
      void invalidateTasks(client)
      toast.success('Task updated', { description: task.title })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

/**
 * Status changes are the highest-frequency action in the app, so they update
 * the cache optimistically and roll back if the request fails.
 */
export function useUpdateTaskStatus() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus; task?: Task }) =>
      tasksApi.updateStatus(id, status),
    onMutate: async ({ id, status }) => {
      await client.cancelQueries({ queryKey: taskKeys.lists() })
      const snapshot = client.getQueriesData<TaskListResponse>({ queryKey: taskKeys.lists() })
      client.setQueriesData<TaskListResponse>({ queryKey: taskKeys.lists() }, (previous) =>
        previous
          ? {
              ...previous,
              data: previous.data.map((task) =>
                task.id === id ? { ...task, status, updatedAt: new Date().toISOString() } : task,
              ),
            }
          : previous,
      )
      return { snapshot }
    },
    onError: (error, _variables, context) => {
      context?.snapshot.forEach(([key, value]) => client.setQueryData(key, value))
      toast.error(getApiErrorMessage(error))
    },
    onSuccess: (task) => {
      if (task.status === 'done') toast.success('Nice — task completed', { description: task.title })
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
