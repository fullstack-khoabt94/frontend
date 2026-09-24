import { useState } from 'react'
import { ChevronDownIcon, Tags } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TAG_COLOR_META } from '@/features/tags/constants'
import { useTagList } from '@/features/tags/queries'
import { cn } from '@/lib/utils'

type Props = {
  /** Selected tag ids; `undefined` when no tag filter is set. */
  value?: string[]
  onChange: (tags: string[] | undefined) => void
  className?: string
}

/**
 * Filter the list by tag — several at once, matched with OR.
 *
 * A `Select` holds one value, so this is the combobox pattern the task dialog's
 * `TagSelect` already uses (`Popover` + `Command`), with a trigger drawn to sit
 * in the filter row beside the priority and sort selects. Picking toggles and
 * keeps the menu open, since choosing several tags is the point of it.
 *
 * **Applied on close, not per click.** Ticks go into a draft, and the draft is
 * committed when the menu closes — clicking outside, Escape, or tabbing away.
 * Otherwise choosing three tags would refetch the list three times and reshuffle
 * it under the menu between clicks.
 */
export function TagFilter({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const { tags, isPending } = useTagList()
  // While open the menu and trigger show the draft; closed, the applied value.
  const selected = new Set(open ? draft : (value ?? []))

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(value ?? [])
    } else {
      const applied = value ?? []
      const changed = draft.length !== applied.length || draft.some((id) => !applied.includes(id))
      // Empty goes back to `undefined`, which drops `?tags=` from the URL.
      if (changed) onChange(draft.length ? draft : undefined)
    }
    setOpen(next)
  }

  const toggle = (id: string) =>
    setDraft((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )

  const chosen = tags.filter((tag) => selected.has(tag.id))
  const label =
    chosen.length === 0
      ? 'Any tag'
      : chosen.length === 1
        ? chosen[0].title
        : `${chosen.length} tags`

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {/* Drawn to match `SelectTrigger` at the filter row's 40px height. */}
        <button
          type="button"
          aria-label="Filter tasks by tag"
          className={cn(
            'flex h-10 items-center gap-1.5 rounded-lg border border-input bg-white py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50',
            className,
          )}
        >
          <Tags className="size-4 shrink-0 text-muted-foreground" />
          {chosen.length === 1 && (
            <span
              aria-hidden
              className={cn('size-2 shrink-0 rounded-full', TAG_COLOR_META[chosen[0].color].dot)}
            />
          )}
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" side="bottom" avoidCollisions={false} className="w-60 p-0">
        <Command>
          <CommandInput placeholder="Search tags…" />
          <CommandList>
            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
              {isPending ? 'Loading tags…' : 'No tags found.'}
            </CommandEmpty>
            <CommandGroup>
              {tags.map((tag) => (
                <CommandItem
                  key={tag.id}
                  // cmdk filters on this, so it is the visible name.
                  value={tag.title}
                  onSelect={() => toggle(tag.id)}
                  data-checked={selected.has(tag.id)}
                >
                  <span
                    aria-hidden
                    className={cn('size-2 shrink-0 rounded-full', TAG_COLOR_META[tag.color].dot)}
                  />
                  <span className="truncate">{tag.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {selected.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    forceMount
                    onSelect={() => setDraft([])}
                    className="justify-center text-muted-foreground"
                  >
                    Clear tag filter
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
