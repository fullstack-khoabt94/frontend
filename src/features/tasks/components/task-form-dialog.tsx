import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PRIORITY_META, STATUS_META } from '../constants'
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  taskFormSchema,
  type Task,
  type TaskFormInput,
  type TaskFormValues,
} from '../schemas'

const EMPTY: TaskFormInput = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
}

function toFormValues(task: Task): TaskFormInput {
  return {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `undefined` puts the dialog in "create" mode. */
  task?: Task
  onSubmit: (values: TaskFormValues) => Promise<unknown>
  isPending: boolean
}

/**
 * One dialog covers both Add and Update — the fields are identical and keeping
 * a single form avoids two validation schemas drifting apart.
 */
export function TaskFormDialog({ open, onOpenChange, task, onSubmit, isPending }: Props) {
  const isEdit = Boolean(task)

  const form = useForm<TaskFormInput, unknown, TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: EMPTY,
  })

  // Reset on every open so a cancelled edit never leaks into the next one.
  useEffect(() => {
    if (open) form.reset(task ? toFormValues(task) : EMPTY)
  }, [open, task, form])

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Rows: header stays pinned, the fields scroll, the footer stays reachable
          even on short viewports (small phones, any phone in landscape). */}
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit task' : 'New task'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the details of this task.' : 'Add something you need to get done.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={submit}
          noValidate
          className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-6"
        >
          <FieldGroup className="-mx-1 min-h-0 overflow-y-auto px-1">
            <Field data-invalid={Boolean(form.formState.errors.title)}>
              <FieldLabel htmlFor="task-title">Title</FieldLabel>
              <Input
                id="task-title"
                placeholder="e.g. Review the design handoff"
                autoFocus
                aria-invalid={Boolean(form.formState.errors.title)}
                {...form.register('title')}
              />
              <FieldError errors={[form.formState.errors.title]} />
            </Field>

            <Field data-invalid={Boolean(form.formState.errors.description)}>
              <FieldLabel htmlFor="task-description">Description</FieldLabel>
              <Textarea
                id="task-description"
                rows={3}
                placeholder="Add any detail that helps you pick this up later."
                {...form.register('description')}
              />
              <FieldDescription>Optional.</FieldDescription>
              <FieldError errors={[form.formState.errors.description]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="task-status">Status</FieldLabel>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="task-status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {STATUS_META[status].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="task-priority" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {PRIORITY_META[priority].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="task-due">Due date</FieldLabel>
              <Input id="task-due" type="date" {...form.register('dueDate')} />
              <FieldDescription>Optional — leave empty for no deadline.</FieldDescription>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
