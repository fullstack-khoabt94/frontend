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
import { taskKeys, taskListQuery } from '@/features/tasks/queries'
import { boardsApi } from './api'
import { buildBoardView, buildProgressByBoard } from './list'
import { boardToFormValues, type Board, type BoardFormValues, type BoardSearch } from './schemas'

export const boardKeys = {
  all: ['boards'] as const,
  list: () => [...boardKeys.all, 'list'] as const,
  detail: (id: string) => [...boardKeys.all, 'detail', id] as const,
}

/** One cached fetch of every board; the two views are derived from it in the browser. */
export const boardListQuery = () =>
  queryOptions({
    queryKey: boardKeys.list(),
    queryFn: () => boardsApi.list(),
  })

export const boardDetailQuery = (id: string) =>
  queryOptions({
    queryKey: boardKeys.detail(id),
    queryFn: () => boardsApi.getById(id),
  })

/**
 * The board grid, plus the per-board task counts.
 *
 * The counts come from the cross-board task list rather than from the board
 * payload — see `buildProgressByBoard`. It is a separate query so a slow or
 * failed task fetch degrades the cards to "no counts" instead of blocking the
 * boards themselves.
 */
export function useBoardList(search: BoardSearch) {
  const query = useQuery(boardListQuery())
  const tasks = useQuery(taskListQuery(null))

  const view = useMemo(() => buildBoardView(query.data ?? [], search), [query.data, search])
  const progress = useMemo(
    () => (tasks.data ? buildProgressByBoard(tasks.data) : undefined),
    [tasks.data],
  )

  return {
    ...query,
    boards: view.boards,
    counts: query.data ? view.counts : undefined,
    progress,
  }
}

export function useBoard(id: string) {
  return useQuery(boardDetailQuery(id))
}

function invalidateBoards(client: QueryClient) {
  return client.invalidateQueries({ queryKey: boardKeys.all })
}

export function useCreateBoard() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (values: BoardFormValues) => boardsApi.create(values),
    onSuccess: (board) => {
      void invalidateBoards(client)
      toast.success('Board created', { description: board.name })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

export function useUpdateBoard() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: BoardFormValues }) =>
      boardsApi.update(id, values),
    onSuccess: (board) => {
      void invalidateBoards(client)
      toast.success('Board updated', { description: board.name })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}

/**
 * Archive and restore are the same call — a full `PUT` rebuilt from the board
 * already in the cache, exactly like `useUpdateTaskStatus` toggles a status.
 * That keeps `UpdateBoardDto` a plain full replace and needs no second endpoint.
 *
 * Optimistic, because the card has to leave the grid the moment it is archived;
 * waiting for a round trip would leave it sitting in a view it no longer
 * belongs to.
 */
export function useSetBoardArchived() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ board, isArchived }: { board: Board; isArchived: boolean }) =>
      boardsApi.update(board.id, { ...boardToFormValues(board), isArchived }),
    onMutate: async ({ board, isArchived }) => {
      await client.cancelQueries({ queryKey: boardKeys.list() })
      const snapshot = client.getQueryData<Board[]>(boardKeys.list())
      client.setQueryData<Board[]>(boardKeys.list(), (previous) =>
        previous?.map((item) => (item.id === board.id ? { ...item, isArchived } : item)),
      )
      return { snapshot }
    },
    onError: (error, _variables, context) => {
      client.setQueryData(boardKeys.list(), context?.snapshot)
      toast.error(getApiErrorMessage(error))
    },
    onSuccess: (board, { isArchived }) => {
      toast.success(isArchived ? 'Board archived' : 'Board restored', { description: board.name })
    },
    onSettled: () => invalidateBoards(client),
  })
}

export function useDeleteBoard() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => boardsApi.remove(id),
    onSuccess: (_data, { name }) => {
      void invalidateBoards(client)
      // Deleting a board takes its tasks with it, so every task list is stale —
      // the cross-board one on /tasks included.
      void client.invalidateQueries({ queryKey: taskKeys.all })
      toast.success('Board deleted', { description: name })
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  })
}
