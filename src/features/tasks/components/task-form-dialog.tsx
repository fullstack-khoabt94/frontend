import { useEffect, useState, type ReactNode } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Pencil } from 'lucide-react'
import { RichTextEditor } from '@/components/rich-text-editor'
import { RichTextView } from '@/components/rich-text-view'
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
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Board } from '@/features/boards/schemas'
import { TagSelect } from '@/features/tags/components/tag-select'
import { useCreateTag, useTagList } from '@/features/tags/queries'
import { PRIORITY_META, STATUS_META } from '../constants'
import {
  sortTags,
  TASK_PRIORITIES,
  TASK_STATUSES,
  taskFormSchema,
  type Task,
  type TaskFormInput,
  type TaskFormValues,
} from '../schemas'
import { PriorityIcon } from './priority-icon'

function emptyValues(boardId: string): TaskFormInput {
  return {
    boardId,
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: '',
    tags: [],
  }
}

function toFormValues(task: Task, fallbackBoardId: string): TaskFormInput {
  return {
    boardId: task.boardId ?? fallbackBoardId,
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    // Sorted on the way in: the response is a `Set`, so the order it arrives in
    // is not stable between reads.
    tags: sortTags(task.tags),
  }
}

/**
 * A label row with a pencil that toggles its field between reading and editing.
 *
 * The pencil only shows while the section is hovered or focused — the prose is
 * what an open task is for, and a row of edit buttons would crowd it. Devices
 * that cannot hover always show it, or the field could never be edited there.
 */
function EditableLabel({
  htmlFor,
  label,
  editing,
  onToggle,
  className,
}: {
  htmlFor: string
  label: string
  editing: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <div className={cn('flex min-h-7 items-center justify-between gap-2', className)}>
      <FieldLabel htmlFor={editing ? htmlFor : undefined}>{label}</FieldLabel>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={editing ? `Stop editing ${label.toLowerCase()}` : `Edit ${label.toLowerCase()}`}
        aria-pressed={editing}
        onClick={onToggle}
        className={cn(
          'text-muted-foreground transition-opacity focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
          editing
            ? 'bg-muted text-foreground opacity-100'
            : 'opacity-0 group-focus-within/editable:opacity-100 group-hover/editable:opacity-100',
        )}
      >
        <Pencil className="size-3.5" />
      </Button>
    </div>
  )
}

/** The read-only face of a field: same padding as its editor, so toggling does not jump. */
function ReadonlyBox({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-transparent px-2.5 py-1.5', className)}>
      {children}
    </div>
  )
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `undefined` puts the dialog in "create" mode. */
  task?: Task
  /**
   * Open an existing task with its title and description already editable —
   * the "Edit task" menu item. Without it they open read-only behind pencils.
   */
  startEditing?: boolean
  onSubmit: (values: TaskFormValues) => Promise<unknown>
  isPending: boolean
  /**
   * The board the task belongs to when the dialog is opened from inside one.
   * Set it and the picker disappears — the board is context, not a choice.
   */
  lockedBoardId?: string
  /**
   * Boards to choose from when there is no locked board. Unused while the board
   * detail page is the only task screen and always locks one.
   * Create-only — see the field below.
   */
  boards?: Board[]
}

/**
 * One dialog covers both Add and Update — the fields are identical and keeping
 * a single form avoids two validation schemas drifting apart.
 */
export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  startEditing = false,
  onSubmit,
  isPending,
  lockedBoardId,
  boards,
}: Props) {
  const isEdit = Boolean(task)
  // Archived boards stay selectable only if the task is already in one, so the
  // picker never silently drops the value it was given.
  const options = (boards ?? []).filter((board) => !board.isArchived || board.id === task?.boardId)

  /**
   * The tag library, fetched once and shared with `/tags` through the same
   * query key — opening this dialog after visiting that screen costs nothing.
   */
  const tagList = useTagList()
  const createTag = useCreateTag()

  const form = useForm<TaskFormInput, unknown, TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: emptyValues(lockedBoardId ?? ''),
  })

  /**
   * Opening a task reads it first: title and description start read-only, each
   * behind its own pencil, while the metadata column stays editable — those are
   * quick picks, the prose is what a stray keystroke would damage. Creating has
   * nothing to read, so both start as editors.
   */
  const [editingTitle, setEditingTitle] = useState(startEditing)
  const [editingDescription, setEditingDescription] = useState(startEditing)

  // Back to the opening mode whenever the dialog opens, or opens on another task.
  // Adjusted during render rather than in an effect, which would paint the
  // stale editors for a frame first.
  const sessionKey = open ? (task?.id ?? 'new') : null
  const [previousSessionKey, setPreviousSessionKey] = useState(sessionKey)
  if (previousSessionKey !== sessionKey) {
    setPreviousSessionKey(sessionKey)
    setEditingTitle(startEditing)
    setEditingDescription(startEditing)
  }

  // Reset on every open so a cancelled edit never leaks into the next one.
  useEffect(() => {
    if (!open) return
    const fallback = lockedBoardId ?? ''
    form.reset(task ? toFormValues(task, fallback) : emptyValues(fallback))
  }, [open, task, lockedBoardId, form])

  const { errors } = form.formState
  // What the read-only faces show: the form's current values, so a title edited
  // and then toggled back still reads as the new text.
  const [titleValue, descriptionValue] = useWatch({
    control: form.control,
    name: ['title', 'description'],
  })
  // A field with an error is always an editor — the message has to sit under
  // something that can be fixed.
  const showTitleEditor = !isEdit || editingTitle || Boolean(errors.title)
  const showDescriptionEditor = !isEdit || editingDescription || Boolean(errors.description)

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Rows: header stays pinned, the fields scroll, the footer stays reachable
          even on short viewports (small phones, any phone in landscape). */}
      <DialogContent
        className={cn(
          'grid h-[calc(100dvh-2rem)] sm:h-[90dvh] sm:max-w-[90vw]',
          // The `sr-only` header is absolutely positioned and takes no grid
          // row, so the form owns the single stretchy row.
          'grid-rows-[minmax(0,1fr)]',
        )}
      >
        {/* The fields speak for themselves, so the header only exists for
            screen readers — Radix still needs a title to name the dialog by. */}
        <DialogHeader className="sr-only">
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
          {/* Two columns from lg: the content being written on the left (3/4),
              the metadata on the right (1/4). Below lg they stack in that order.
              The whole body scrolls as one so the footer stays pinned. */}
          <div className="-mx-1 grid min-h-0 gap-6 overflow-y-auto px-1 lg:grid-cols-[3fr_1fr]">
            <FieldGroup>
              <Field data-invalid={Boolean(errors.title)} className="group/editable">
                {isEdit ? (
                  <EditableLabel
                    htmlFor="task-title"
                    label="Title"
                    // With no visible header this row is the top of the dialog;
                    // below `lg` it spans the width, under the close button.
                    className="pr-8 lg:pr-0"
                    editing={showTitleEditor}
                    onToggle={() => setEditingTitle((value) => !value)}
                  />
                ) : (
                  <FieldLabel htmlFor="task-title">Title</FieldLabel>
                )}
                {showTitleEditor ? (
                  <Input
                    id="task-title"
                    placeholder="e.g. Review the design handoff"
                    // Create opens straight into the title; an edit focuses it
                    // only once its pencil is pressed.
                    autoFocus
                    aria-invalid={Boolean(errors.title)}
                    {...form.register('title')}
                  />
                ) : (
                  <ReadonlyBox>
                    <p className="text-base font-medium wrap-anywhere md:text-sm">{titleValue}</p>
                  </ReadonlyBox>
                )}
                <FieldError errors={[errors.title]} />
              </Field>

              <Field data-invalid={Boolean(errors.description)} className="group/editable">
                {isEdit ? (
                  <EditableLabel
                    htmlFor="task-description"
                    label="Description"
                    editing={showDescriptionEditor}
                    onToggle={() => setEditingDescription((value) => !value)}
                  />
                ) : (
                  <FieldLabel htmlFor="task-description">Description</FieldLabel>
                )}
                {showDescriptionEditor ? (
                  <Controller
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <RichTextEditor
                        id="task-description"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        className="[&_.tiptap]:min-h-40 lg:[&_.tiptap]:min-h-72"
                        placeholder="Add any detail that helps you pick this up later."
                        invalid={Boolean(errors.description)}
                      />
                    )}
                  />
                ) : (
                  <ReadonlyBox className="py-2">
                    {descriptionValue ? (
                      <RichTextView
                        html={descriptionValue}
                        className="text-base wrap-anywhere md:text-sm"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">No description.</p>
                    )}
                  </ReadonlyBox>
                )}
                <FieldError errors={[errors.description]} />
              </Field>
            </FieldGroup>

            <FieldGroup className="lg:border-l lg:pl-6">
              {!lockedBoardId && (
                <Field data-invalid={Boolean(form.formState.errors.boardId)}>
                  <FieldLabel htmlFor="task-board">Board</FieldLabel>
                  <Controller
                    control={form.control}
                    name="boardId"
                    render={({ field }) => (
                      // Disabled when editing: the path board only authorises the
                      // call, `updateTask` never reassigns `task.board`, so the
                      // change could not be saved. Shown rather than hidden so the
                      // row still says which board the task is in.
                      <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                        <SelectTrigger
                          id="task-board"
                          className="w-full"
                          aria-invalid={Boolean(form.formState.errors.boardId)}
                        >
                          <SelectValue placeholder="Choose a board" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((board) => (
                            <SelectItem key={board.id} value={board.id}>
                              <span className="mr-1">{board.icon ?? '📋'}</span>
                              {board.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldDescription>
                    {isEdit
                      ? 'A task cannot be moved between boards.'
                      : 'Where this task will live.'}
                  </FieldDescription>
                  <FieldError errors={[form.formState.errors.boardId]} />
                </Field>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
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
                              <PriorityIcon priority={priority} />
                              {PRIORITY_META[priority].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>

              <Field data-invalid={Boolean(form.formState.errors.dueDate)}>
                <FieldLabel htmlFor="task-due">Due date</FieldLabel>
                <Input
                  id="task-due"
                  type="date"
                  aria-invalid={Boolean(form.formState.errors.dueDate)}
                  {...form.register('dueDate')}
                />
                <FieldError errors={[form.formState.errors.dueDate]} />
              </Field>

              {/* Metadata, so it belongs in this column alongside status,
                  priority and the due date rather than beside the prose on the
                  left. The picker is built for a narrow column: the trigger
                  grows to fit its chips instead of clipping them, and the
                  popover takes the trigger's width. */}
              <Field>
                <FieldLabel htmlFor="task-tags">Tags</FieldLabel>
                <Controller
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <TagSelect
                      id="task-tags"
                      value={field.value ?? []}
                      onChange={field.onChange}
                      options={tagList.tags}
                      isLoading={tagList.isPending}
                      // Creating from here is offered; deleting is not — see the
                      // note on `TagSelect`. A tag removed here only leaves this
                      // task, and stays in the library.
                      allowCreate
                      isCreating={createTag.isPending}
                      onCreate={(values) => createTag.mutateAsync(values)}
                    />
                  )}
                />
              </Field>
            </FieldGroup>
          </div>

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
