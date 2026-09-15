import DOMPurify from 'dompurify'

/**
 * Only the markup the editor toolbar can produce. Anything else — pasted
 * `<script>`, inline handlers, `style` — is stripped before it touches the DOM.
 * The backend must sanitise too; this guards the render, not the storage.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'u',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'a',
  'hr',
]
const ALLOWED_ATTR = ['href', 'target', 'rel']

export function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Descriptions saved before the editor existed are plain text. Treating them as
 * HTML would eat any `<` and collapse line breaks, so wrap each line in a `<p>`.
 */
export function toRichHtml(value: string | null | undefined) {
  if (!value) return ''
  if (/^\s*<(p|h[23]|ul|ol|blockquote|pre)[\s>]/i.test(value)) return value
  return value
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

/** Visible text only — for validation, search, and length limits. */
export function htmlToPlainText(html: string | null | undefined) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(sanitizeHtml(toRichHtml(html)), 'text/html')
  return (doc.body.textContent ?? '').trim()
}
