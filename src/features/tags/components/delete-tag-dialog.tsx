import { ConfirmDialog } from '@/components/common/confirm-dialog'
import type { Tag } from '../schemas'

type Props = {
  tag?: Tag
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isPending: boolean
}

/**
 * Deleting a tag is confirmed, and the copy is blunt about the part the API
 * does silently: `tagRepository.delete` removes the row, and V6's
 * `ON DELETE CASCADE` on `task_tags` takes every link with it. So this is not
 * only "remove from the library" — it strips the tag off every task carrying
 * it, with no undo and no archived state to fall back to, unlike boards.
 *
 * The count of affected tasks is deliberately absent rather than guessed: no
 * endpoint reports it. `TagResponse` exposes no task count, and the task list
 * is board-scoped and paginated, so the only honest number would cost a request
 * per board. Saying "every task" is true at any count.
 */
export function DeleteTagDialog({ tag, onOpenChange, onConfirm, isPending }: Props) {
  return (
    <ConfirmDialog
      open={Boolean(tag)}
      onOpenChange={onOpenChange}
      title="Delete this tag?"
      description={
        <>
          <span className="font-medium text-foreground">{tag?.title}</span> is removed from every
          task that carries it. The tasks themselves are kept. This cannot be undone.
        </>
      }
      confirmLabel="Delete tag"
      onConfirm={onConfirm}
      isPending={isPending}
    />
  )
}
