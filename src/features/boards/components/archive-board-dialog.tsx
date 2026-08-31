import { Loader2 } from 'lucide-react'
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
    <AlertDialog open={Boolean(board)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive this board?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{board?.title}</span> moves to the
            Archived tab
            {hasTasks
              ? `, and its ${taskCount} task${taskCount === 1 ? '' : 's'} are kept.`
              : '.'}{' '}
            There is no way to restore it from here.
          </AlertDialogDescription>
        </AlertDialogHeader>
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
            Archive board
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
