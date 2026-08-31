import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Loader2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { BOARD_COLOR_META } from '../constants'
import {
  BOARD_COLORS,
  BOARD_ICONS,
  boardFormSchema,
  DEFAULT_BOARD_COLOR,
  DEFAULT_BOARD_ICON,
  type Board,
  type BoardFormInput,
  type BoardFormValues,
} from '../schemas'

const EMPTY: BoardFormInput = {
  title: '',
  description: '',
  color: DEFAULT_BOARD_COLOR,
  icon: DEFAULT_BOARD_ICON,
}

function toFormValues(board: Board): BoardFormInput {
  return {
    title: board.title,
    description: board.description ?? '',
    color: board.color,
    icon: board.icon ?? DEFAULT_BOARD_ICON,
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `undefined` puts the dialog in "create" mode. */
  board?: Board
  onSubmit: (values: BoardFormValues) => Promise<unknown>
  isPending: boolean
}

/** One dialog covers both Add and Update, mirroring `TaskFormDialog`. */
export function BoardFormDialog({ open, onOpenChange, board, onSubmit, isPending }: Props) {
  const isEdit = Boolean(board)

  const form = useForm<BoardFormInput, unknown, BoardFormValues>({
    resolver: zodResolver(boardFormSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (open) form.reset(board ? toFormValues(board) : EMPTY)
  }, [open, board, form])

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Same height discipline as the task dialog: header and footer pinned,
          only the fields scroll, so Create stays reachable in landscape. */}
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit board' : 'New board'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the details of this board.'
              : 'Group related tasks together under one board.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={submit}
          noValidate
          className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-6"
        >
          <FieldGroup className="-mx-1 min-h-0 overflow-y-auto px-1">
            <Field data-invalid={Boolean(form.formState.errors.title)}>
              <FieldLabel htmlFor="board-title">Title</FieldLabel>
              <Input
                id="board-title"
                placeholder="e.g. Product launch"
                maxLength={50}
                autoFocus
                aria-invalid={Boolean(form.formState.errors.title)}
                {...form.register('title')}
              />
              <FieldDescription>Up to 50 characters.</FieldDescription>
              <FieldError errors={[form.formState.errors.title]} />
            </Field>

            <Field data-invalid={Boolean(form.formState.errors.description)}>
              <FieldLabel htmlFor="board-description">Description</FieldLabel>
              <Textarea
                id="board-description"
                rows={3}
                placeholder="What belongs on this board?"
                aria-invalid={Boolean(form.formState.errors.description)}
                {...form.register('description')}
              />
              <FieldError errors={[form.formState.errors.description]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="board-icon">Icon</FieldLabel>
              <Controller
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <div
                    id="board-icon"
                    role="radiogroup"
                    aria-label="Board icon"
                    className="flex flex-wrap gap-2"
                  >
                    {BOARD_ICONS.map((icon) => {
                      const active = field.value === icon
                      return (
                        <button
                          key={icon}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={`Icon ${icon}`}
                          onClick={() => field.onChange(icon)}
                          className={cn(
                            'grid size-10 place-items-center rounded-lg border text-lg transition-colors',
                            'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                            active
                              ? 'border-brand-500 bg-brand-50'
                              : 'border-border hover:bg-muted',
                          )}
                        >
                          {icon}
                        </button>
                      )
                    })}
                  </div>
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="board-color">Colour</FieldLabel>
              <Controller
                control={form.control}
                name="color"
                render={({ field }) => (
                  <div
                    id="board-color"
                    role="radiogroup"
                    aria-label="Board colour"
                    className="flex flex-wrap gap-2"
                  >
                    {BOARD_COLORS.map((color) => {
                      const active = field.value === color
                      const meta = BOARD_COLOR_META[color]
                      return (
                        <button
                          key={color}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={meta.label}
                          onClick={() => field.onChange(color)}
                          className={cn(
                            // `text-background`, not `text-white`: the swatches
                            // are dark on light and light on dark, so the tick
                            // has to invert with them.
                            'grid size-9 place-items-center rounded-full text-background transition-transform',
                            'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                            meta.swatch,
                            active
                              ? 'ring-2 ring-foreground/70 ring-offset-2 ring-offset-background'
                              : 'hover:scale-105',
                          )}
                        >
                          {/* The tick, not colour alone, is what marks the
                              selection — a ring around one swatch in a row of
                              swatches is not distinguishable to everyone. */}
                          {active && <Check className="size-4" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create board'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
