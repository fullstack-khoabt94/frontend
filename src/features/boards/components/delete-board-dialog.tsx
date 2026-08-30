import { Archive, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { Board } from '../schemas'

type Props = {
  board?: Board
  /** Tasks that would go with it, or `undefined` while the count is unknown. */
  taskCount?: number
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onArchiveInstead: () => void
  isPending: boolean
}

/**
 * Deleting a board takes its tasks with it, so the copy has to say so with a
 * number rather than a vague warning — and archiving is offered right here,
 * because "I want it out of my way" is the far more common intent and it is
 * reversible.
 */
export function DeleteBoardDialog({
  board,
  taskCount,
  onOpenChange,
  onConfirm,
  onArchiveInstead,
  isPending,
}: Props) {
  const hasTasks = taskCount !== undefined && taskCount > 0

  return (
    <AlertDialog open={Boolean(board)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this board?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{board?.name}</span>
            {hasTasks
              ? ` and its ${taskCount} task${taskCount === 1 ? '' : 's'} will be removed permanently.`
              : ' will be removed permanently.'}{' '}
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!board?.isArchived && (
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            disabled={isPending}
            onClick={onArchiveInstead}
          >
            <Archive className="size-4" />
            Archive instead — keeps everything
          </Button>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
            disabled={isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Delete board
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
