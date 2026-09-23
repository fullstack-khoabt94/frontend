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
    <AlertDialog open={Boolean(tag)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this tag?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{tag?.title}</span> is removed from every
            task that carries it. The tasks themselves are kept. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          {/* `variant`, not a `bg-destructive` className. `AlertDialogAction`
              renders a `<Button asChild>`, so the variant's classes and any
              className land on two different elements and are concatenated
              rather than merged by tailwind-merge — `bg-primary` and
              `bg-destructive` both survive and the stylesheet's order decides,
              which paints the button brand navy. The variant is the only way
              to actually change it. */}
          <AlertDialogAction
            variant="destructive"
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
            disabled={isPending}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Delete tag
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
