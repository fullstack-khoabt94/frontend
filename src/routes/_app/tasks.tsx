import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * The cross-board task list is gone, and this route only keeps old links alive.
 *
 * Tasks are nested under their board — `GET /board/{boardId}/task/all` — so
 * there is no longer any request that returns tasks from more than one board.
 * One screen cannot be assembled from one call, and assembling it from N calls
 * would defeat the pagination the endpoint exists to provide.
 *
 * The reason this page was kept before no longer holds either: it existed so
 * board-less tasks had somewhere to appear, and `V5__create_boards_table.sql`
 * made `tasks.board_id NOT NULL`, so such a task can no longer exist.
 *
 * Bringing it back needs a genuinely new endpoint — a top-level `/task/all`
 * scoped to the authenticated principal's boards — not a tweak to this one: the
 * nested route derives its authorisation from `{boardId}`, so it has no shape in
 * which the board is absent. Until then, boards are the only way in.
 */
export const Route = createFileRoute('/_app/tasks')({
  beforeLoad: () => {
    throw redirect({ to: '/boards', search: { view: 'active', q: '' }, replace: true })
  },
})
