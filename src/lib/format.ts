import { format, formatDistanceToNowStrict, isPast, isToday, isTomorrow } from 'date-fns'

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

export function formatRelative(iso: string) {
  return `${formatDistanceToNowStrict(new Date(iso))} ago`
}

export function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
