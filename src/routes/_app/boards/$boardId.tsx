import { useEffect, useRef, useState } from 'react'
import { createFileRoute, notFound, useLocation, useNavigate } from '@tanstack/react-router'
import axios from 'axios'
import { Archive, MoreHorizontal, Pencil, Plus } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { ArchiveBoardDialog } from '@/features/boards/components/archive-board-dialog'
import { BoardFormDialog } from '@/features/boards/components/board-form-dialog'
import { BoardNotFound } from '@/features/boards/components/board-not-found'
import { BOARD_COLOR_META } from '@/features/boards/constants'
import {
  boardDetailQuery,
  useArchiveBoard,
  useBoard,
  useUpdateBoard,
} from '@/features/boards/queries'
import { DEFAULT_BOARD_ICON, type BoardFormValues } from '@/features/boards/schemas'
import { DeleteTaskDialog } from '@/features/tasks/components/delete-task-dialog'
import { TaskEmptyState } from '@/features/tasks/components/task-empty-state'
import { TaskFilterBar } from '@/features/tasks/components/task-filter-bar'
import { TaskFormDialog } from '@/features/tasks/components/task-form-dialog'
import { TaskItem, TaskItemSkeleton } from '@/features/tasks/components/task-item'
import { TaskPagination } from '@/features/tasks/components/task-pagination'
import { TaskSummary } from '@/features/tasks/components/task-summary'
import {
  useCreateTask,
  useDeleteTask,
  useTaskList,
  useTaskStats,
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
  /**
   * Resolve the board before the page mounts, so a bad id lands on
   * `BoardNotFound` instead of a header skeleton next to a task list for a board
   * that is not there. A malformed id never reaches the API — Spring would turn
   * it into a 400, not a 404. Any other failure (network, 5xx) still goes to the
   * error boundary.
   */
  loader: async ({ context, params }) => {
    if (!z.uuid().safeParse(params.boardId).success) throw notFound()
    try {
      await context.queryClient.ensureQueryData(boardDetailQuery(params.boardId))
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) throw notFound()
      throw error
    }
  },
  notFoundComponent: BoardNotFound,
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

/**
 * The filters that always appear in the address bar, defaults included.
 *
 * `priority` and `dueOnOrBefore` are deliberately not here: "any priority" and
 * "any due date" are the absence of the parameter, so spelling them out would
 * mean inventing an `ALL` value the backend has no equivalent for.
 */
const URL_FILTER_KEYS = ['filter', 'q', 'sort', 'page', 'size'] as const

function BoardDetailPage({ boardId }: { boardId: string }) {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  /**
   * The query string — but only while the address is still this board's.
   * Leaving (the header's "Boards" link, say) updates the location before this
   * page unmounts, and the effects below would otherwise answer the new URL's
   * missing filters with a navigate `from` this route. With no `boardId` left in
   * the address to fill the path, that lands on `/boards/undefined`.
   */
  const searchStr = useLocation({
    select: (location) =>
      location.pathname.replace(/\/$/, '') === `/boards/${boardId}` ? location.searchStr : null,
  })
  const isOnThisBoard = searchStr !== null

  /**
   * Write the resolved view back into the URL, so arriving at a bare
   * `/boards/:id` leaves an address that states every filter it is showing
   * rather than relying on defaults nobody can see. Replaces rather than
   * pushes: it is the same view, not a step the Back button should undo.
   */
  useEffect(() => {
    if (searchStr === null) return
    const params = new URLSearchParams(searchStr)
    if (URL_FILTER_KEYS.every((key) => params.has(key))) return
    void navigate({ search: (previous) => previous, replace: true })
  }, [searchStr, navigate])

  const [searchInput, setSearchInput] = useState(search.q)
  /**
   * 500ms rather than the hook's 300 default, because this box is a request
   * now: `?search=` goes to the server and drags the three count queries along
   * with it, so every keystroke that slips through is four calls. The longer
   * pause is also what a mid-word hesitation costs — 300 fires partway through
   * "rele|ase" often enough to be worth avoiding.
   */
  const debouncedSearch = useDebouncedValue(searchInput, 500)

  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | undefined>()
  /** Whether the dialog opens with the title and description already editable. */
  const [startEditing, setStartEditing] = useState(false)
  const [deletingTask, setDeletingTask] = useState<Task | undefined>()
  const [boardFormOpen, setBoardFormOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

  useEffect(() => {
    if (!isOnThisBoard || debouncedSearch === search.q) return
    void navigate({
      // Back to page 1: the old page number belongs to the unfiltered list, and
      // keeping it would land the visitor on an empty page of a shorter result.
      search: (previous) => ({ ...previous, q: debouncedSearch, page: 1 }),
      replace: true,
    })
  }, [isOnThisBoard, debouncedSearch, search.q, navigate])

  const board = useBoard(boardId)
  const updateBoard = useUpdateBoard()
  const archiveBoard = useArchiveBoard()

  const list = useTaskList(search, boardId)
  /**
   * The badge and summary counts. They follow the search box and the priority
   * select but **not** the status tabs — a tab's own badge has to keep saying
   * how many rows it holds while a different tab is open.
   */
  const stats = useTaskStats(boardId, search.q, search.priority, search.dueOnOrBefore, search.tags)
  const createTask = useCreateTask(boardId)
  const updateTask = useUpdateTask(boardId)
  const updateStatus = useUpdateTaskStatus(boardId)
  const deleteTask = useDeleteTask(boardId)

  const { tasks, pageMeta } = list
  const isInitialLoading = list.isPending
  const stickySentinelRef = useRef<HTMLDivElement>(null)
  const [isFilterStuck, setIsFilterStuck] = useState(false)
  useEffect(() => {
    const sentinel = stickySentinelRef.current
    if (!sentinel) return
    // The top margin is the header's height, so "out of view" means "under it".
    const observer = new IntersectionObserver(
      ([entry]) => setIsFilterStuck(!entry.isIntersecting && entry.boundingClientRect.top < 64),
      { rootMargin: '-64px 0px 0px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // A page swap keeps the previous rows on screen; dim them rather than tearing
  // the list down into skeletons.
  const isSwappingPage = list.isPlaceholderData
  /**
   * Everything the stats follow — the status tabs are the one filter they
   * deliberately ignore, so this is `isNarrowed` minus the tab.
   */
  const countsNarrowed =
    Boolean(search.q) ||
    Boolean(search.priority) ||
    Boolean(search.dueOnOrBefore) ||
    Boolean(search.tags)
  /** True when the view shows a subset of the board rather than all of it. */
  const isNarrowed =
    Boolean(search.q) ||
    search.filter !== 'all' ||
    Boolean(search.priority) ||
    Boolean(search.dueOnOrBefore) ||
    Boolean(search.tags)
  /**
   * Only meaningful on the unnarrowed view, where `total` is every task in the
   * board. Under a filter it counts matches instead, so the header and the
   * archive dialog say nothing rather than quoting the wrong figure.
   */
  const boardTotal = isNarrowed ? undefined : pageMeta?.total

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
    if (!isOnThisBoard || !pageMeta || pageMeta.totalPages === 0) return
    if (search.page <= pageMeta.totalPages) return
    void navigate({
      search: (previous) => ({ ...previous, page: pageMeta.totalPages }),
      replace: true,
    })
  }, [isOnThisBoard, pageMeta, search.page, navigate])

  const openCreate = () => {
    setEditingTask(undefined)
    setFormOpen(true)
  }

  const openEdit = (task: Task, options?: { editing: boolean }) => {
    setEditingTask(task)
    setStartEditing(options?.editing ?? false)
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

  const data = board.data
  const color = data ? BOARD_COLOR_META[data.color] : undefined

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-8 sm:px-6 sm:pt-5 sm:pb-10">
      <div className="mb-2 flex items-center justify-between gap-3 sm:mb-0 sm:items-start sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
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
          {data ? (
            <h1 className="min-w-0 text-2xl font-semibold tracking-tight wrap-anywhere sm:text-3xl">
              {data.title}
            </h1>
          ) : (
            <span className="block h-8 w-48 animate-pulse rounded bg-muted" />
          )}
          <TaskSummary stats={stats} isNarrowed={countsNarrowed} />

          {data && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Board actions"
                  className="shrink-0 text-muted-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onSelect={() => setBoardFormOpen(true)}>
                  <Pencil className="size-4" />
                  Edit board
                </DropdownMenuItem>
                {/* Archived boards lose the item: nothing on the API sets
                        `isArchived` back, so there is no second state to toggle to. */}
                {!data.isArchived && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setArchiveOpen(true)}>
                      <Archive className="size-4" />
                      Archive board
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Stays on the title's line at every width: below `sm` it shrinks
            to a square "+", its label kept for screen readers only. */}
        <div className="flex shrink-0 gap-2">
          <Button size="lg" className="size-10 px-0 sm:w-auto sm:px-2.5" onClick={openCreate}>
            <Plus className="size-4" />
            <span className="sr-only sm:not-sr-only">Task</span>
          </Button>
        </div>
      </div>

      {data?.isArchived && (
        <div className="mb-4 rounded-xl border border-dashed bg-muted/40 p-4 text-sm">
          <p className="text-muted-foreground">
            This board is archived. Its tasks are still here and still editable, but the board
            cannot be restored from here.
          </p>
        </div>
      )}

      <div className="space-y-8">
        <section className="space-y-4">
          {countsNarrowed && (
            <p className="text-xs text-muted-foreground">
              Counts describe the tasks matching your search, not the whole board.
            </p>
          )}

          {/* Zero-height marker: once it scrolls under the navbar, the controls
              below have stuck and get their shadow. */}
          {/* `mb-0` cancels the section's `space-y` margin, which would otherwise
              open a 16px gap under a zero-height element. */}
          <div ref={stickySentinelRef} aria-hidden className="mb-0" />
          {/* Pinned under the 64px app header (`h-16` in `AppHeader`) from
              `sm` up. Below that the controls stack into most of a phone
              screen, so pinning them would leave no room for the list. The
              backdrop is a full-viewport `::before` behind the controls, so it
              reaches the window's edges like the header while the controls stay
              in the content column; `AppLayout` clips the overflow it causes.
              `-mt-1` pulls it toward the board header without trimming the
              padding it needs once stuck under the navbar. */}
          <div
            data-stuck={isFilterStuck || undefined}
            className="relative space-y-4 sm:sticky sm:top-16 sm:z-30 sm:-mt-1 sm:py-3 sm:before:absolute sm:before:inset-y-0 sm:before:left-1/2 sm:before:-z-10 sm:before:w-screen sm:before:-translate-x-1/2 sm:before:bg-background sm:data-stuck:before:shadow-[0_4px_12px_-4px_rgb(0_0_0/0.15)]"
          >
            <TaskFilterBar
              filter={search.filter}
              onFilterChange={(filter) => changeSearch({ filter })}
              search={searchInput}
              onSearchChange={setSearchInput}
              priority={search.priority}
              onPriorityChange={(priority) => changeSearch({ priority })}
              dueOnOrBefore={search.dueOnOrBefore}
              onDueChange={(dueOnOrBefore) => changeSearch({ dueOnOrBefore })}
              tags={search.tags}
              onTagsChange={(tags) => changeSearch({ tags })}
              onClearFilters={() =>
                changeSearch({
                  priority: undefined,
                  dueOnOrBefore: undefined,
                  tags: undefined,
                })
              }
              sort={search.sort}
              onSortChange={(sort) => changeSearch({ sort })}
              stats={stats}
            />

            {pageMeta && (
              <TaskPagination
                meta={pageMeta}
                onPageChange={(page) => void navigate({ search: (prev) => ({ ...prev, page }) })}
                onSizeChange={(size) => changeSearch({ size })}
                isFetching={list.isFetching}
                isNarrowed={isNarrowed}
              />
            )}
          </div>

          {isInitialLoading ? (
            <ul className="divide-y overflow-hidden rounded-xl border">
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
              // One framed list, rows split by hairlines rather than spaced cards.
              className={cn(
                'divide-y overflow-hidden rounded-xl border transition-opacity',
                isSwappingPage && 'opacity-60',
              )}
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
        </section>
      </div>

      {/* The board is context here, so the dialog hides its picker entirely. */}
      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        startEditing={startEditing}
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
        // Only when it is the board's real count — see `boardTotal`.
        taskCount={boardTotal}
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
