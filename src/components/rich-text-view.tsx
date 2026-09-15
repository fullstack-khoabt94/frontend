import { useMemo } from 'react'
import { sanitizeHtml, toRichHtml } from '@/lib/rich-text'
import { cn } from '@/lib/utils'

/** Read-only render of editor output. Always sanitised — never trust stored HTML. */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  const safe = useMemo(() => sanitizeHtml(toRichHtml(html)), [html])
  return <div className={cn('rich-text', className)} dangerouslySetInnerHTML={{ __html: safe }} />
}
