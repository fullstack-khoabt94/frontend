import { CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-brand-900 text-white shadow-sm dark:bg-brand-200 dark:text-brand-900">
        <CheckCheck className="size-5" />
      </span>
      {showWordmark && (
        <span className="text-lg font-semibold tracking-tight">
          Task<span className="text-brand-500">flow</span>
        </span>
      )}
    </span>
  )
}
