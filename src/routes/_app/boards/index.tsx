import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { ArchiveBoardDialog } from '@/features/boards/components/archive-board-dialog'
import { BoardCard, BoardCardSkeleton } from '@/features/boards/components/board-card'
import { BoardEmptyState } from '@/features/boards/components/board-empty-state'
import { BoardFormDialog } from '@/features/boards/components/board-form-dialog'
import { BOARD_VIEW_META } from '@/features/boards/constants'
import { progressFor } from '@/features/boards/list'
import {
  useArchiveBoard,
  useBoardList,
  useCreateBoard,
  useUpdateBoard,
} from '@/features/boards/queries'
import {
  BOARD_VIEWS,
  boardSearchSchema,
  type Board,
  type BoardFormValues,
} from '@/features/boards/schemas'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/boards/')({
  // View and search live in the URL, so "my archived boards" is linkable.
  validateSearch: boardSearchSchema,
  component: BoardsPage,
})

function BoardsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const [searchInput, setSearchInput] = useState(search.q)
  const debouncedSearch = useDebouncedValue(searchInput, 300)

  const [formOpen, setFormOpen] = useState(false)
  const [editingBoard, setEditingBoard] = useState<Board | undefined>()
  const [archivingBoard, setArchivingBoard] = useState<Board | undefined>()

  useEffect(() => {
    if (debouncedSearch === search.q) return
    void navigate({ search: (previous) => ({ ...previous, q: debouncedSearch }), replace: true })
  }, [debouncedSearch, search.q, navigate])

  const list = useBoardList(search)
  const createBoard = useCreateBoard()
  const updateBoard = useUpdateBoard()
  const archiveBoard = useArchiveBoard()

  const { boards, counts, progress } = list
  const isInitialLoading = list.isPending

  const openCreate = () => {
    setEditingBoard(undefined)
    setFormOpen(true)
  }

  const openEdit = (board: Board) => {
    setEditingBoard(board)
    setFormOpen(true)
  }

  const handleSubmit = async (values: BoardFormValues) => {
    if (editingBoard) {
      await updateBoard.mutateAsync({ id: editingBoard.id, values })
    } else {
      await createBoard.mutateAsync(values)
    }
    setFormOpen(false)
  }

  const handleArchive = () => {
    if (!archivingBoard) return
    archiveBoard.mutate(
      { board: archivingBoard },
      { onSettled: () => setArchivingBoard(undefined) },
    )
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Boards</h1>
          <p className="text-sm text-muted-foreground">
            Group your tasks by project, then open a board to work in it.
          </p>
        </div>
        <Button size="lg" className="h-10 shrink-0" onClick={openCreate}>
          <Plus className="size-4" />
          New board
        </Button>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search boards…"
              aria-label="Search boards"
              className="h-10 pr-9 pl-9"
            />
            {searchInput && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Clear search"
                onClick={() => setSearchInput('')}
                className="absolute top-1/2 right-1.5 -translate-y-1/2"
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>

          {/* Two views only, so the segmented strip fits at every width — no
              select fallback is needed here, unlike the five task filters. */}
          <div
            role="tablist"
            aria-label="Filter boards"
            className="inline-flex gap-1 rounded-xl border bg-card p-1"
          >
            {BOARD_VIEWS.map((option) => {
              const active = option === search.view
              return (
                <button
                  key={option}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() =>
                    void navigate({ search: (previous) => ({ ...previous, view: option }) })
                  }
                  className={cn(
                    'inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                    'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    active
                      ? 'bg-brand-900 text-white dark:bg-brand-200 dark:text-brand-900'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {BOARD_VIEW_META[option].label}
                  {counts && (
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-xs tabular-nums',
                        active ? 'bg-white/20 dark:bg-brand-900/15' : 'bg-muted',
                      )}
                    >
                      {counts[option]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{BOARD_VIEW_META[search.view].description}</p>

        {isInitialLoading ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <BoardCardSkeleton key={index} />
            ))}
          </ul>
        ) : boards.length === 0 ? (
          <BoardEmptyState
            view={search.view}
            search={search.q}
            onCreate={openCreate}
            onClearSearch={() => setSearchInput('')}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy={list.isFetching}>
            {boards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                progress={progressFor(progress, board.id)}
                hasProgress={progress !== undefined}
                onEdit={openEdit}
                onArchive={setArchivingBoard}
              />
            ))}
          </ul>
        )}
      </div>

      <BoardFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        board={editingBoard}
        onSubmit={handleSubmit}
        isPending={createBoard.isPending || updateBoard.isPending}
      />

      <ArchiveBoardDialog
        board={archivingBoard}
        taskCount={archivingBoard ? progressFor(progress, archivingBoard.id).total : undefined}
        onOpenChange={(open) => !open && setArchivingBoard(undefined)}
        onConfirm={handleArchive}
        isPending={archiveBoard.isPending}
      />
    </main>
  )
}
