import { format, isPast, isToday, isTomorrow } from 'date-fns'

export function formatDueDate(iso: string | null | undefined) {
  if (!iso) return null
  const date = new Date(iso)
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'd MMM yyyy')
}

export function isOverdue(iso: string | null | undefined) {
  if (!iso) return false
  const date = new Date(iso)
  return isPast(date) && !isToday(date)
}

/**
 * A plain calendar date, for timestamps that are context rather than a
 * deadline — "Created 3 Feb 2026".
 *
 * Deliberately not `formatDueDate`: that one answers "how soon" and resolves to
 * Today / Tomorrow, which reads as urgency. A `createdAt` is never urgent, and
 * "Created Today" beside a tag would be noise.
 */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  return format(new Date(iso), 'd MMM yyyy')
}

export function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
