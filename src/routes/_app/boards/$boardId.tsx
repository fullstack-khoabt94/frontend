import { useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Archive, ChevronLeft, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { ArchiveBoardDialog } from '@/features/boards/components/archive-board-dialog'
import { BoardFormDialog } from '@/features/boards/components/board-form-dialog'
import { BOARD_COLOR_META } from '@/features/boards/constants'
import { useArchiveBoard, useBoard, useUpdateBoard } from '@/features/boards/queries'
import { DEFAULT_BOARD_ICON, type BoardFormValues } from '@/features/boards/schemas'
import { DeleteTaskDialog } from '@/features/tasks/components/delete-task-dialog'
import { TaskEmptyState } from '@/features/tasks/components/task-empty-state'
import { TaskFilterBar } from '@/features/tasks/components/task-filter-bar'
import { TaskFormDialog } from '@/features/tasks/components/task-form-dialog'
import { TaskItem, TaskItemSkeleton } from '@/features/tasks/components/task-item'
import { TaskPagination } from '@/features/tasks/components/task-pagination'
import { TaskSummary } from '@/features/tasks/components/task-summary'
import { FILTER_META } from '@/features/tasks/constants'
import {
  useCreateTask,
  useDeleteTask,
  useTaskList,
  useUpdateTask,
  useUpdateTaskStatus,
} from '@/features/tasks/queries'
import {
  taskSearchSchema,
  type Task,
  type TaskFormValues,
  type TaskStatus,
} from '@/features/tasks/schemas'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/boards/$boardId')({
  // Filter, search, sort *and* the page live in the URL, so any page of any
  // board is linkable and survives a refresh.
  validateSearch: taskSearchSchema,
  component: BoardDetailRoute,
})

/**
 * Keying on the board id remounts the page when moving between boards, which
 * re-seeds the search box from that board's URL. Doing it with an effect
 * instead would set state during render and cascade an extra pass.
 */
function BoardDetailRoute() {
  const { boardId } = Route.useParams()
  return <BoardDetailPage key={boardId} boardId={boardId} />
}

function BoardDetailPage({ boardId }: { boardId: string }) {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const [searchInput, setSearchInput] = useState(search.q)
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>()
  const [deletingTask, setDeletingTask] = useState<Task | undefined>()
  const [boardFormOpen, setBoardFormOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

  useEffect(() => {
    if (debouncedSearch === search.q) return
    void navigate({
      // Back to page 1: the old page number belongs to the unfiltered list, and
      // keeping it would land the visitor on an empty page of a shorter result.
      search: (previous) => ({ ...previous, q: debouncedSearch, page: 1 }),
      replace: true,
    })
  }, [debouncedSearch, search.q, navigate])

  const board = useBoard(boardId)
  const updateBoard = useUpdateBoard()
  const archiveBoard = useArchiveBoard()

  const list = useTaskList(search, boardId)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const updateStatus = useUpdateTaskStatus()
  const deleteTask = useDeleteTask()

  const { tasks, stats, pageMeta } = list
  const isInitialLoading = list.isPending
  // A page swap keeps the previous rows on screen; dim them rather than tearing
  // the list down into skeletons.
  const isSwappingPage = list.isPlaceholderData
  const isNarrowed = Boolean(search.q) || search.filter !== 'all'

  /** Any change to what is being listed restarts at page 1. */
  const changeSearch = (next: Partial<typeof search>) =>
    void navigate({ search: (previous) => ({ ...previous, ...next, page: 1 }) })

  /**
   * Deleting the last row of the last page — or opening a stale `?page=` link —
   * leaves the visitor past the end, where the server answers with an empty
   * `data` and the screen reads "Showing 41–40 of 40". Fall back to the last
   * page that exists.
   */
  useEffect(() => {
    if (!pageMeta || pageMeta.totalPages === 0) return
    if (search.page <= pageMeta.totalPages) return
    void navigate({
      search: (previous) => ({ ...previous, page: pageMeta.totalPages }),
      replace: true,
    })
  }, [pageMeta, search.page, navigate])

  const openCreate = () => {
    setEditingTask(undefined)
    setFormOpen(true)
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setFormOpen(true)
  }

  const handleSubmit = async (values: TaskFormValues) => {
    if (editingTask) {
      await updateTask.mutateAsync({ id: editingTask.id, values })
    } else {
      await createTask.mutateAsync(values)
      // Under the default "Newest first" the new row is on page 1, so creating
      // one from page 4 would file it out of sight. Jumping back is right for
      // that ordering and harmless for the others, where its position is not
      // predictable from here anyway.
      changeSearch({})
    }
    setFormOpen(false)
  }

  const handleStatusChange = (task: Task, status: TaskStatus) => {
    if (task.status === status) return
    updateStatus.mutate({ task, status })
  }

  const handleDelete = () => {
    if (!deletingTask) return
    deleteTask.mutate(
      { id: deletingTask.id, title: deletingTask.title },
      { onSettled: () => setDeletingTask(undefined) },
    )
  }

  const handleBoardSubmit = async (values: BoardFormValues) => {
    await updateBoard.mutateAsync({ id: boardId, values })
    setBoardFormOpen(false)
  }

  if (board.isError) {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Board not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been deleted, or the link is wrong.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/boards" search={{ view: 'active', q: '' }}>
            Back to boards
          </Link>
        </Button>
      </main>
    )
  }

  const data = board.data
  const color = data ? BOARD_COLOR_META[data.color] : undefined

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground">
        <Link to="/boards" search={{ view: 'active', q: '' }}>
          <ChevronLeft className="size-4" />
          All boards
        </Link>
      </Button>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {data ? (
            <span
              aria-hidden
              className={cn(
                'grid size-11 shrink-0 place-items-center rounded-xl text-xl',
                color?.tile,
              )}
            >
              {data.icon ?? DEFAULT_BOARD_ICON}
            </span>
          ) : (
            <span className="size-11 shrink-0 animate-pulse rounded-xl bg-muted" />
          )}

          <div className="min-w-0 space-y-1">
            {data ? (
              <h1 className="text-2xl font-semibold tracking-tight wrap-anywhere sm:text-3xl">
                {data.title}
              </h1>
            ) : (
              <span className="block h-8 w-48 animate-pulse rounded bg-muted" />
            )}
            <p className="text-sm text-muted-foreground wrap-anywhere">
              {/* The fallback counts the whole board, not the page — `total` is
                  the one figure the server sends that spans every page. */}
              {data?.description ??
                (pageMeta
                  ? `${pageMeta.total} task${pageMeta.total === 1 ? '' : 's'} in this board.`
                  : ' ')}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {data && (
            <>
              <Button
                variant="outline"
                size="lg"
                className="h-10"
                onClick={() => setBoardFormOpen(true)}
              >
                <Pencil className="size-4" />
                <span className="sr-only sm:not-sr-only">Edit board</span>
              </Button>
              {/* Archived boards lose the button: nothing on the API sets
                  `isArchived` back, so there is no second state to toggle to. */}
              {!data.isArchived && (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-10"
                  onClick={() => setArchiveOpen(true)}
                >
                  <Archive className="size-4" />
                  <span className="sr-only">Archive board</span>
                </Button>
              )}
            </>
          )}
          <Button size="lg" className="h-10" onClick={openCreate}>
            <Plus className="size-4" />
            New task
          </Button>
        </div>
      </div>

      {data?.isArchived && (
        <div className="mb-6 rounded-xl border border-dashed bg-muted/40 p-4 text-sm">
          <p className="text-muted-foreground">
            This board is archived. Its tasks are still here and still editable, but the board
            cannot be restored from here.
          </p>
        </div>
      )}

      <div className="space-y-8">
        <TaskSummary
          stats={stats}
          isLoading={isInitialLoading}
          scopedToPage={(pageMeta?.totalPages ?? 1) > 1}
        />

        <section className="space-y-4">
          <TaskFilterBar
            filter={search.filter}
            onFilterChange={(filter) => changeSearch({ filter })}
            search={searchInput}
            onSearchChange={setSearchInput}
            sort={search.sort}
            onSortChange={(sort) => changeSearch({ sort })}
            stats={stats}
          />

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              {FILTER_META[search.filter].label}
              {stats ? ` · ${tasks.length}` : ''}
            </h2>
            <p className="text-xs text-muted-foreground">
              {FILTER_META[search.filter].description}
            </p>
          </div>

          {isInitialLoading ? (
            <ul className="space-y-3">
              {[0, 1, 2, 3].map((index) => (
                <TaskItemSkeleton key={index} />
              ))}
            </ul>
          ) : tasks.length === 0 ? (
            <TaskEmptyState
              filter={search.filter}
              search={search.q}
              onCreate={openCreate}
              onClearSearch={() => setSearchInput('')}
            />
          ) : (
            <ul
              className={cn('space-y-3 transition-opacity', isSwappingPage && 'opacity-60')}
              aria-busy={list.isFetching}
            >
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onEdit={openEdit}
                  onDelete={setDeletingTask}
                  onStatusChange={handleStatusChange}
                  isMutating={deleteTask.isPending && deleteTask.variables?.id === task.id}
                />
              ))}
            </ul>
          )}

          {pageMeta && (
            <TaskPagination
              meta={pageMeta}
              onPageChange={(page) => void navigate({ search: (prev) => ({ ...prev, page }) })}
              onSizeChange={(size) => changeSearch({ size })}
              isFetching={list.isFetching}
              isNarrowed={isNarrowed}
            />
          )}
        </section>
      </div>

      {/* The board is context here, so the dialog hides its picker entirely. */}
      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        onSubmit={handleSubmit}
        isPending={createTask.isPending || updateTask.isPending}
        lockedBoardId={boardId}
      />

      <DeleteTaskDialog
        task={deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(undefined)}
        onConfirm={handleDelete}
        isPending={deleteTask.isPending}
      />

      <BoardFormDialog
        open={boardFormOpen}
        onOpenChange={setBoardFormOpen}
        board={data}
        onSubmit={handleBoardSubmit}
        isPending={updateBoard.isPending}
      />

      <ArchiveBoardDialog
        board={archiveOpen ? data : undefined}
        // The board's real task count, not the page's.
        taskCount={pageMeta?.total}
        onOpenChange={setArchiveOpen}
        onConfirm={() => {
          if (!data) return
          archiveBoard.mutate({ board: data }, { onSettled: () => setArchiveOpen(false) })
        }}
        isPending={archiveBoard.isPending}
      />
    </main>
  )
}
