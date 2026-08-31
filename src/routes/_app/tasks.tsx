import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * The cross-board task list is gone, and this route only keeps old links alive.
 *
 * `GET /task/all` takes `boardId` as a **required** parameter
 * (`@RequestParam(required = true)`), so there is no longer any request that
 * returns tasks from more than one board — one screen cannot be assembled from
 * one call, and assembling it from N calls would defeat the pagination the
 * endpoint exists to provide.
 *
 * The reason this page was kept before no longer holds either: it existed so
 * board-less tasks had somewhere to appear, and `V5__create_boards_table.sql`
 * made `tasks.board_id NOT NULL`, so such a task can no longer exist.
 *
 * Bringing it back is a small change if the backend grows a cross-board list —
 * `boardId` made optional on the controller, or a `/task/all` that falls back to
 * the authenticated principal's boards. Until then, boards are the only way in.
 */
export const Route = createFileRoute('/_app/tasks')({
  beforeLoad: () => {
    throw redirect({ to: '/boards', search: { view: 'active', q: '' }, replace: true })
  },
})
