import type { Task } from '@/features/tasks/schemas'
import type { Board, BoardProgress, BoardSearch } from './schemas'

/**
 * Searching and the active/archived split happen in the browser, for the same
 * reason `features/tasks/list.ts` exists: `GET /board/all` takes no parameters.
 * If it later grows `?q=` and `?archived=`, delete this half of the module.
 */
function matchesSearch(board: Board, q: string) {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    board.name.toLowerCase().includes(needle) ||
    (board.description ?? '').toLowerCase().includes(needle)
  )
}

export function buildBoardView(boards: Board[], search: BoardSearch) {
  const searched = boards.filter((board) => matchesSearch(board, search.q))
  const wantArchived = search.view === 'archived'

  return {
    boards: searched
      .filter((board) => board.isArchived === wantArchived)
      // Boards have no createdAt, so name is the only stable order available.
      .sort((a, b) => a.name.localeCompare(b.name)),
    counts: {
      active: searched.filter((board) => !board.isArchived).length,
      archived: searched.filter((board) => board.isArchived).length,
    },
  }
}

const EMPTY_PROGRESS: BoardProgress = { total: 0, done: 0, completion: 0 }

/**
 * Per-board task counts.
 *
 * `BoardResponse` carries no counts, so the board grid derives them from the
 * one `GET /task/all` it already has cached. That is a deliberate trade: it
 * reuses a live endpoint instead of inventing a contract the backend has not
 * built, and it costs one request that the /tasks screen makes anyway.
 *
 * When the backend adds `taskCount` / `doneCount` to `BoardResponse`, delete
 * this function and read the fields off the board.
 */
export function buildProgressByBoard(tasks: Task[]): Map<string, BoardProgress> {
  const progress = new Map<string, BoardProgress>()

  for (const task of tasks) {
    if (!task.boardId) continue
    const current = progress.get(task.boardId) ?? { total: 0, done: 0, completion: 0 }
    current.total += 1
    if (task.status === 'DONE') current.done += 1
    progress.set(task.boardId, current)
  }

  for (const entry of progress.values()) {
    entry.completion = entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0
  }

  return progress
}

export function progressFor(progress: Map<string, BoardProgress> | undefined, boardId: string) {
  return progress?.get(boardId) ?? EMPTY_PROGRESS
}
