import type { Task, TaskFilter, TaskSearch, TaskSort, TaskStats } from './schemas'

/**
 * Filtering, searching, sorting and counting all happen in the browser.
 *
 * `GET /task/all` accepts no query parameters and returns every task in one
 * array, so there is nothing to push server-side yet. If the backend later
 * grows `?filter=&q=&sort=` plus a stats envelope, this whole module goes away
 * and `tasksApi.list` forwards the search params instead.
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

const PRIORITY_WEIGHT = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const

function sortTasks(tasks: Task[], sort: TaskSort) {
  const sorted = [...tasks]
  switch (sort) {
    case 'due_asc':
      // Tasks without a deadline sink to the bottom rather than sorting as "empty".
      return sorted.sort((a, b) => {
        if (!a.dueDate) return b.dueDate ? 1 : 0
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      })
    case 'title_asc':
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case 'priority_desc':
    default:
      return sorted.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
  }
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

export function buildListView(tasks: Task[], search: TaskSearch) {
  const searched = tasks.filter((task) => matchesSearch(task, search.q))
  return {
    tasks: sortTasks(
      searched.filter((task) => matchesFilter(task, search.filter)),
      search.sort,
    ),
    stats: buildStats(searched),
  }
}
