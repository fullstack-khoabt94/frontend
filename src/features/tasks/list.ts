import type { Task, TaskFilter, TaskSearch, TaskStats } from './schemas'

/**
 * What is left of the client-side list pipeline after the backend took over
 * paging and sorting.
 *
 * `GET /task/all` now scopes by `boardId`, pages and sorts — so board narrowing
 * and `sortTasks` are gone from here entirely. What it still does not accept is
 * a status or a keyword, so **the filter and the search box narrow one page of
 * results, not the whole board.** That is a real limitation, not a rounding
 * error: on a board with 60 tasks, "Done" shows the done tasks *among the 20
 * currently loaded*, and the tab counts describe the same 20.
 *
 * The UI is built to say so rather than hide it — `TaskPagination` reports the
 * server's totals alongside the page range, and `TaskSummary` labels its counts
 * as page-scoped whenever there is more than one page.
 *
 * Delete this module the moment `TaskController` accepts `?status=` and `?q=`;
 * everything in it becomes a query parameter and the counts become honest.
 */

const FILTER_STATUS = {
  todo: 'TODO',
  in_progress: 'IN_PROGRESS',
  done: 'DONE',
} as const

function matchesFilter(task: Task, filter: TaskFilter) {
  switch (filter) {
    case 'all':
      return true
    case 'not_done':
      return task.status !== 'DONE'
    default:
      return task.status === FILTER_STATUS[filter]
  }
}

function matchesSearch(task: Task, q: string) {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    task.title.toLowerCase().includes(needle) ||
    (task.description ?? '').toLowerCase().includes(needle)
  )
}

/**
 * Counts describe "how many would I see if I switched to that tab", so they are
 * computed after the search term is applied but before the status filter.
 */
function buildStats(searched: Task[]): TaskStats {
  return {
    all: searched.length,
    not_done: searched.filter((task) => task.status !== 'DONE').length,
    todo: searched.filter((task) => task.status === 'TODO').length,
    in_progress: searched.filter((task) => task.status === 'IN_PROGRESS').length,
    done: searched.filter((task) => task.status === 'DONE').length,
  }
}

/**
 * @param tasks the single page the server returned, already sorted by it.
 * Nothing here reorders the rows — doing so would shuffle a page against the
 * ordering the pagination is walking through.
 */
export function buildPageView(tasks: Task[], search: TaskSearch) {
  const searched = tasks.filter((task) => matchesSearch(task, search.q))
  return {
    tasks: searched.filter((task) => matchesFilter(task, search.filter)),
    stats: buildStats(searched),
  }
}
