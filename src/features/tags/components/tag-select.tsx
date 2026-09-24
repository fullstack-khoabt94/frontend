import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronsUpDown, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  type TagColor,
  type TagFormValues,
} from '../schemas'
import { TagChip } from './tag-chip'

type Props = {
  id?: string
  /** The tags currently on the task. Whole objects, not ids — see `tasksApi`. */
  value: Tag[]
  onChange: (tags: Tag[]) => void
  /** Every tag the user owns, from `useTagList`. */
  options: Tag[]
  isLoading?: boolean
  disabled?: boolean
  /**
   * Enables the "Create …" row and its inline panel.
   *
   * Creating is offered here because reaching for a tag you have not made yet
   * is the common case while writing a task, and sending the writer to another
   * screen would lose the half-filled form.
   *
   * **Deleting is deliberately not offered**, and this is the one asymmetry in
   * the component. Removing a tag from *this* task is local and reversible; a
   * real delete is global, hard (`tagRepository.delete`, no archived state) and
   * cascades the tag off every other task through `task_tags`. That is far too
   * destructive to sit one click away from a picker, where it would also be
   * easily mistaken for "remove from this task" — the two would be adjacent and
   * read almost identically. Deleting lives on `/tags`, behind a confirm dialog
   * that names the consequence.
   */
  allowCreate?: boolean
  onCreate?: (values: TagFormValues) => Promise<Tag>
  isCreating?: boolean
}

/**
 * The searchable, multi-select tag picker.
 *
 * shadcn's `<Select>` is single-value and not searchable, so this is the
 * combobox pattern from the same library — `Popover` + `Command` (cmdk) — which
 * is what shadcn itself reaches for when a select has to be typed into. The
 * trigger keeps the select's look so it sits beside the status and priority
 * selects in the task dialog without reading as a different control.
 */
export function TagSelect({
  id,
  value,
  onChange,
  options,
  isLoading,
  disabled,
  allowCreate,
  onCreate,
  isCreating,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const selectedIds = useMemo(() => new Set(value.map((tag) => tag.id)), [value])

  /**
   * Leaving the popover discards a half-typed search and any open create panel,
   * so reopening it is always a clean start rather than a resumed one.
   *
   * Done in the handler rather than an effect on `open`: setting state
   * synchronously inside an effect cascades an extra render, which
   * `react-hooks/set-state-in-effect` rejects. Closing is an event, so the
   * event is where the reset belongs.
   */
  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) return
    setSearch('')
    setCreating(false)
  }

  const toggle = (tag: Tag) => {
    onChange(selectedIds.has(tag.id) ? value.filter((item) => item.id !== tag.id) : [...value, tag])
  }

  const remove = (tag: Tag) => onChange(value.filter((item) => item.id !== tag.id))

  const trimmed = search.trim()
  /**
   * Offer "Create" only for a name that is not already taken — matching the
   * database's case-insensitive `lower(title)` index, so the row never proposes
   * something the server is about to reject as a duplicate.
   */
  const canOfferCreate =
    Boolean(allowCreate && onCreate) && trimmed.length > 0 && !isDuplicateTagTitle(options, trimmed)

  const handleCreated = (tag: Tag) => {
    // Select it straight away: the writer typed the name to use it, not to file
    // it away. Nothing else would happen otherwise and it would look like a no-op.
    onChange([...value, tag])
    setCreating(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {/**
         * **A `div`, not a `<button>`.** The chips live in the trigger and each
         * carries its own remove button, and a button inside a button is
         * invalid markup that React will warn about and browsers nest
         * unpredictably.
         *
         * Dropping the element means re-supplying what it gave for free:
         * `role="combobox"` and `aria-expanded` for the semantics, `tabIndex`
         * so it is still reachable by keyboard, and an explicit `onKeyDown` —
         * a `div` does not turn Enter or Space into a click the way a button
         * does, so without it the picker could be focused but never opened
         * without a mouse. `aria-label` rather than the `<FieldLabel>`'s
         * `htmlFor`, which only associates with real form controls.
         */}
        <div
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-label="Tags"
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(event) => {
            if (disabled) return
            if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'ArrowDown') return
            event.preventDefault()
            handleOpenChange(true)
          }}
          className={cn(
            // Shaped like an Input rather than a Button: it holds content and
            // grows with it, so `h-auto min-h-9` and wrapping are the point.
            'flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm shadow-xs transition-colors',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            'dark:bg-input/30',
            disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-muted/50',
          )}
        >
          {value.length === 0 ? (
            <span className="text-muted-foreground">
              {isLoading ? 'Loading tags…' : 'Add tags…'}
            </span>
          ) : (
            value.map((tag) => (
              <TagChip key={tag.id} tag={tag} onRemove={disabled ? undefined : remove} />
            ))
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 self-start opacity-50" />
        </div>
      </PopoverTrigger>

      {/* Matches the trigger's width, like a select's menu would. */}
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        side="bottom"
        align="start"
        avoidCollisions={false}
      >
        {creating && onCreate ? (
          <InlineCreateTag
            initialTitle={trimmed}
            existingTags={options}
            isPending={Boolean(isCreating)}
            onCancel={() => setCreating(false)}
            onCreate={async (values) => handleCreated(await onCreate(values))}
          />
        ) : (
          <Command>
            <CommandInput
              placeholder="Search tags…"
              value={search}
              onValueChange={setSearch}
              autoFocus
            />
            <CommandList>
              {/* cmdk renders this only when nothing matched, so the create
                    row below has to live outside it to stay reachable while a
                    partial match is still on screen. */}
              <CommandEmpty className="py-4 text-sm text-muted-foreground">
                {isLoading ? 'Loading tags…' : 'No tags found.'}
              </CommandEmpty>

              <CommandGroup>
                {options.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    // Searched on, so it must be the visible name rather than
                    // the id — cmdk filters by this string.
                    value={tag.title}
                    onSelect={() => toggle(tag)}
                    data-checked={selectedIds.has(tag.id)}
                  >
                    <span
                      aria-hidden
                      className={cn('size-2 shrink-0 rounded-full', TAG_COLOR_META[tag.color].dot)}
                    />
                    <span className="truncate">{tag.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>

              {canOfferCreate && (
                <>
                  {/* `forceMount` on the group as well as the item: cmdk
                        hides a group with no matching children, so without it
                        the create row disappears in exactly the case it exists
                        for — a name that matches no tag. The separator takes no
                        such prop in this version, so it is rendered plainly and
                        only when there is something above it to separate. */}
                  {options.length > 0 && <CommandSeparator />}
                  <CommandGroup forceMount>
                    <CommandItem
                      // Never matches what is typed, so cmdk would filter it
                      // out on its own terms; `forceMount` is what overrides
                      // that.
                      value={`__create__${trimmed}`}
                      forceMount
                      onSelect={() => setCreating(true)}
                    >
                      <Plus className="size-4" />
                      <span className="truncate">Create “{trimmed}”</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  )
}

type InlineCreateProps = {
  initialTitle: string
  existingTags: Tag[]
  isPending: boolean
  onCancel: () => void
  onCreate: (values: TagFormValues) => Promise<void>
}

/**
 * Quick-create, inside the popover.
 *
 * It asks for a description because it has to: both tag DTOs mark the field
 * `@NotBlank`, so a title-only quick add would be a 400. Defaulting it to the
 * tag's own name would dodge that, but it would be inventing content on the
 * user's behalf and putting it in their library — better to ask for one line.
 *
 * **Not a `<form>` element**, deliberately: this renders inside the task
 * dialog's form, and although Radix portals the popover out of that DOM
 * subtree, keeping it a `<div>` makes nesting impossible in every case and
 * stops Enter from ever submitting the task while a tag is being written.
 */
function InlineCreateTag({
  initialTitle,
  existingTags,
  isPending,
  onCancel,
  onCreate,
}: InlineCreateProps) {
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<TagColor>(DEFAULT_TAG_COLOR)
  const [error, setError] = useState<string>()
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => titleRef.current?.focus(), [])

  const submit = async () => {
    const parsed = tagFormSchema.safeParse({ title, description, color })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the fields above')
      return
    }
    if (isDuplicateTagTitle(existingTags, parsed.data.title)) {
      setError('You already have a tag with this name')
      return
    }
    setError(undefined)
    await onCreate(parsed.data)
  }

  return (
    <div className="space-y-3 p-3">
      <p className="text-sm font-medium">New tag</p>

      <Input
        ref={titleRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Name"
        maxLength={50}
        aria-label="Tag name"
        aria-invalid={Boolean(error)}
      />

      <Textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="What does this tag mean?"
        rows={2}
        aria-label="Tag description"
      />

      <ToggleGroup
        type="single"
        value={color}
        onValueChange={(next) => next && setColor(next as TagColor)}
        aria-label="Tag colour"
        className="flex-wrap"
      >
        {TAG_COLORS.map((option) => (
          <ToggleGroupItem
            key={option}
            value={option}
            aria-label={TAG_COLOR_META[option].label}
            className={cn(
              'size-6 rounded-full',
              TAG_COLOR_META[option].swatch,
              option === color && 'ring-2 ring-foreground/70 ring-offset-2 ring-offset-background',
            )}
          />
        ))}
      </ToggleGroup>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void submit()} disabled={isPending}>
          {isPending && <Loader2 className="size-3.5 animate-spin" />}
          Create
        </Button>
      </div>
    </div>
  )
}
