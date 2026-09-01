import type { Board, BoardSearch } from './schemas'

/**
 * Searching and the active/archived split happen in the browser, for the same
 * reason `features/tasks/list.ts` exists: `GET /board/all` takes no parameters.
 * If it later grows `?q=` and `?archived=`, delete this half of the module.
 */
function matchesSearch(board: Board, q: string) {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    board.title.toLowerCase().includes(needle) ||
    (board.description ?? '').toLowerCase().includes(needle)
  )
}

export function buildBoardView(boards: Board[], search: BoardSearch) {
  const searched = boards.filter((board) => matchesSearch(board, search.q))
  const wantArchived = search.view === 'archived'

  return {
    boards: searched
      .filter((board) => board.isArchived === wantArchived)
      // BoardResponse does carry createdAt, but title is the order that reads
      // best on a grid the user is scanning by name.
      .sort((a, b) => a.title.localeCompare(b.title)),
    counts: {
      active: searched.filter((board) => !board.isArchived).length,
      archived: searched.filter((board) => board.isArchived).length,
    },
  }
}

/**
 * There are no per-board task counts here any more, and there is no way to
 * compute them.
 *
 * The grid used to derive "3 of 8 done" from one cross-board `GET /task/all`.
 * Tasks are nested under their board now and the call returns one page, so the only ways to
 * rebuild the counts would be a request per board (N+1 on the landing page) or
 * a request per board large enough to hold every task — which is the "fetch
 * everything" the pagination was added to stop.
 *
 * So the cards dropped the progress bar instead of showing a number that is
 * quietly wrong. `BoardResponse` needs `taskCount` and `doneCount`; both are a
 * `COUNT(*)` on a table already indexed by board, and the card is still shaped
 * to display them.
 */
