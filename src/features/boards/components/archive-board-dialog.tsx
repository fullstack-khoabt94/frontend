import { ConfirmDialog } from '@/components/common/confirm-dialog'
import type { Board } from '../schemas'

type Props = {
  board?: Board
  /** Tasks that go with it, or `undefined` while the count is unknown. */
  taskCount?: number
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isPending: boolean
}

/**
 * Archiving is confirmed, not silent, and the copy is blunt about two things
 * the API forces:
 *
 * - it cannot be undone from this app, because nothing sets `isArchived` back
 * - the tasks are kept, because `deleteBoard` is a soft delete that never
 *   touches them
 *
 * Both are surprising enough that leaving them to be discovered would be worse
 * than saying them here.
 */
export function ArchiveBoardDialog({
  board,
  taskCount,
  onOpenChange,
  onConfirm,
  isPending,
}: Props) {
  const hasTasks = taskCount !== undefined && taskCount > 0

  return (
    <ConfirmDialog
      open={Boolean(board)}
      onOpenChange={onOpenChange}
      title="Archive this board?"
      description={
        <>
          <span className="font-medium text-foreground">{board?.title}</span> moves to the Archived
          tab
          {hasTasks
            ? `, and its ${taskCount} task${taskCount === 1 ? '' : 's'} are kept.`
            : '.'}{' '}
          There is no way to restore it from here.
        </>
      }
      confirmLabel="Archive board"
      onConfirm={onConfirm}
      isPending={isPending}
    />
  )
}
