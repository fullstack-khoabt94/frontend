import type { ReactNode } from 'react'
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

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** What happens, in plain words — the reason the dialog exists. */
  description: ReactNode
  /** The action's own name ("Delete task"), never a bare "OK". */
  confirmLabel: string
  cancelLabel?: string
  /** `destructive` for anything that removes or cannot be undone. */
  variant?: 'default' | 'destructive'
  onConfirm: () => void
  /** Disables both buttons and spins the confirm while the request runs. */
  isPending?: boolean
}

/**
 * The one confirm-before-acting dialog — delete task, archive board, delete tag
 * all go through it, so they look and behave the same.
 *
 * Confirming does **not** close the dialog. The caller closes it once the
 * request settles, which keeps it on screen, spinner and all, while the work is
 * in flight; Radix would otherwise shut it on click.
 *
 * The colour comes from `variant`, not a `bg-destructive` className:
 * `AlertDialogAction` renders a `<Button asChild>`, so the variant's classes and
 * a className land on two elements and are concatenated rather than merged —
 * both backgrounds survive and the stylesheet order picks the brand navy.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'destructive',
  onConfirm,
  isPending = false,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
            disabled={isPending}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
