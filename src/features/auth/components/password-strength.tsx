import { cn } from '@/lib/utils'
import { passwordStrength } from '../schemas'

const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const
const BARS = [
  'bg-destructive',
  'bg-destructive',
  'bg-brand-200',
  'bg-brand-500',
  'bg-status-done',
] as const

export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null
  const score = passwordStrength(value)

  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              index < score ? BARS[score] : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Password strength: {LABELS[score]}</p>
    </div>
  )
}
