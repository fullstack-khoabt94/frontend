import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { CalendarCheck, ListChecks, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/common/logo'
import { ModeToggle } from '@/components/mode-toggle'

const HIGHLIGHTS = [
  {
    icon: ListChecks,
    title: 'One list, four views',
    body: 'Filter by to do, in progress, done — or everything at once.',
  },
  {
    icon: CalendarCheck,
    title: 'Always know what is next',
    body: 'Due dates and priorities surface the work that matters today.',
  },
  {
    icon: ShieldCheck,
    title: 'Your account, your data',
    body: 'Sessions expire safely and passwords reset in two clicks.',
  },
]

/**
 * Shared frame for Login / Signup / Forgot / Reset.
 * Left column is brand storytelling (hidden below lg), right column is the form.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between bg-brand-900 p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(35rem_25rem_at_20%_0%,var(--brand-500),transparent_60%),radial-gradient(30rem_22rem_at_90%_90%,var(--brand-200),transparent_55%)]"
        />
        <div className="relative">
          <Link to="/login" className="inline-flex">
            <span className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
                <ListChecks className="size-5" />
              </span>
              <span className="text-lg font-semibold tracking-tight">
                Task<span className="text-brand-200">flow</span>
              </span>
            </span>
          </Link>
        </div>

        <div className="relative max-w-md space-y-8">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
            Everything you need to do, finally in one place.
          </h2>
          <ul className="space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title: heading, body }) => (
              <li key={heading} className="flex gap-3.5">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-white/10">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{heading}</span>
                  <span className="block text-sm text-brand-200">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-200">© {new Date().getFullYear()} Taskflow</p>
      </aside>

      <main className="auth-backdrop flex min-h-svh flex-col">
        <header className="flex items-center justify-between p-5 lg:justify-end">
          <Logo className="lg:hidden" />
          <ModeToggle />
        </header>

        <div className="flex flex-1 items-center justify-center px-5 pb-12">
          <div className="w-full max-w-sm">
            <div className="mb-7 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
            {footer && (
              <div className="mt-7 text-center text-sm text-muted-foreground">{footer}</div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
