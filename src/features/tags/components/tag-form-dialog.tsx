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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { TAG_COLOR_META } from '../constants'
import {
  DEFAULT_TAG_COLOR,
  isDuplicateTagTitle,
  TAG_COLORS,
  tagFormSchema,
  type Tag,
  type TagFormInput,
  type TagFormValues,
} from '../schemas'

const EMPTY: TagFormInput = {
  title: '',
  description: '',
  color: DEFAULT_TAG_COLOR,
}

function toFormValues(tag: Tag): TagFormInput {
  return {
    title: tag.title,
    description: tag.description ?? '',
    color: tag.color,
  }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `undefined` puts the dialog in "create" mode. */
  tag?: Tag
  onSubmit: (values: TagFormValues) => Promise<unknown>
  isPending: boolean
  /**
   * Every tag the user already has, so a duplicate name can be caught on the
   * field rather than as a toast full of Postgres. See the submit handler.
   */
  existingTags?: Tag[]
  /** Prefills the name — the picker passes what was typed into its search box. */
  initialTitle?: string
}

/** One dialog covers both Add and Update, mirroring `BoardFormDialog`. */
export function TagFormDialog({
  open,
  onOpenChange,
  tag,
  onSubmit,
  isPending,
  existingTags,
  initialTitle,
}: Props) {
  const isEdit = Boolean(tag)

  const form = useForm<TagFormInput, unknown, TagFormValues>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    form.reset(tag ? toFormValues(tag) : { ...EMPTY, title: initialTitle ?? '' })
  }, [open, tag, initialTitle, form])

  /**
   * The duplicate check runs here rather than inside the zod schema because it
   * needs the tag list, which the schema has no access to.
   *
   * It is a nicety, not the guard: V6's `unique index user_title_index on tags
   * (user_id, lower(title))` is what actually enforces uniqueness, and a second
   * browser tab can still win the race. What it buys is the message — the
   * backend's `DataIntegrityViolationException` handler returns `ex.getMessage()`
   * verbatim, which is raw Postgres naming the index and the key, so without
   * this the user would see that in a toast instead of a field error.
   */
  const submit = form.handleSubmit(async (values) => {
    if (isDuplicateTagTitle(existingTags ?? [], values.title, tag?.id)) {
      form.setError('title', { message: 'You already have a tag with this name' })
      return
    }
    await onSubmit(values)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Same height discipline as the other two dialogs: header and footer
          pinned, only the fields scroll, so Save stays reachable in landscape. */}
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit tag' : 'New tag'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Renaming a tag updates it on every task that carries it.'
              : 'Tags are shared across all your boards.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={submit}
          noValidate
          className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-6"
        >
          <FieldGroup className="-mx-1 min-h-0 overflow-y-auto px-1">
            <Field data-invalid={Boolean(form.formState.errors.title)}>
              <FieldLabel htmlFor="tag-title">Name</FieldLabel>
              <Input
                id="tag-title"
                placeholder="e.g. Urgent"
                maxLength={50}
                autoFocus
                aria-invalid={Boolean(form.formState.errors.title)}
                {...form.register('title')}
              />
              <FieldDescription>Up to 50 characters, and unique among your tags.</FieldDescription>
              <FieldError errors={[form.formState.errors.title]} />
            </Field>

            <Field data-invalid={Boolean(form.formState.errors.description)}>
              <FieldLabel htmlFor="tag-description">Description</FieldLabel>
              <Textarea
                id="tag-description"
                rows={3}
                placeholder="What does this tag mean?"
                aria-invalid={Boolean(form.formState.errors.description)}
                {...form.register('description')}
              />
              {/* Required by the API, not by the design — both tag DTOs mark
                  description @NotBlank, so an empty box is a 400. */}
              <FieldDescription>Required.</FieldDescription>
              <FieldError errors={[form.formState.errors.description]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="tag-color">Colour</FieldLabel>
              <Controller
                control={form.control}
                name="color"
                render={({ field }) => (
                  <ToggleGroup
                    type="single"
                    id="tag-color"
                    value={field.value}
                    // Every tag carries a colour, so clicking the current one
                    // must not clear it back to Radix's empty value.
                    onValueChange={(value) => value && field.onChange(value)}
                    aria-label="Tag colour"
                    className="flex-wrap"
                  >
                    {TAG_COLORS.map((color) => {
                      const active = field.value === color
                      const meta = TAG_COLOR_META[color]
                      return (
                        <ToggleGroupItem
                          key={color}
                          value={color}
                          aria-label={meta.label}
                          className={cn(
                            // `text-background`, not `text-white`: the swatches
                            // invert between themes and the tick must follow.
                            'size-9 rounded-full text-background transition-transform',
                            'hover:text-background',
                            meta.swatch,
                            active
                              ? 'ring-2 ring-foreground/70 ring-offset-2 ring-offset-background'
                              : 'hover:scale-105',
                          )}
                        >
                          {/* The tick, not colour alone, marks the selection. */}
                          {active && <Check className="size-4" />}
                        </ToggleGroupItem>
                      )
                    })}
                  </ToggleGroup>
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
              {isEdit ? 'Save changes' : 'Create tag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
