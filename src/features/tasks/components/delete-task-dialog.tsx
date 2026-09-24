import { ConfirmDialog } from '@/components/common/confirm-dialog'
import type { Task } from '../schemas'

type Props = {
  task?: Task
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isPending: boolean
}

export function DeleteTaskDialog({ task, onOpenChange, onConfirm, isPending }: Props) {
  return (
    <ConfirmDialog
      open={Boolean(task)}
      onOpenChange={onOpenChange}
      title="Delete this task?"
      description={
        <>
          <span className="font-medium text-foreground">{task?.title}</span> will be removed
          permanently. This cannot be undone.
        </>
      }
      confirmLabel="Delete task"
      onConfirm={onConfirm}
      isPending={isPending}
    />
  )
}
