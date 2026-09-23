import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TAG_COLOR_META } from '../constants'
import type { Tag } from '../schemas'

type Props = {
  tag: Tag
  /** Renders a remove button inside the chip. Omit it and the chip is read-only. */
  onRemove?: (tag: Tag) => void
  className?: string
}

/**
 * The one way a tag is drawn — task rows, the picker's trigger and the
 * management list all use this, so a tag looks the same everywhere it appears.
 *
 * `max-w-40` + `truncate` rather than `wrap-anywhere`: a chip is an inline
 * label sitting in a row of other chips, so a 50-character tag name has to
 * cut off rather than push the row apart. The full name is in the `title`
 * attribute for anyone who needs it.
 */
export function TagChip({ tag, onRemove, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex max-w-40 items-center gap-1 rounded-full px-2 py-0.5 text-xs',
        TAG_COLOR_META[tag.color].chip,
        className,
      )}
      title={tag.title}
    >
      <span className="truncate">{tag.title}</span>
      {onRemove && (
        <button
          type="button"
          // Nested in a form, so it must say it is not a submit button — and it
          // stops propagation because the chip can sit inside a clickable row.
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onRemove(tag)
          }}
          aria-label={`Remove tag ${tag.title}`}
          className="-mr-0.5 rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  )
}
