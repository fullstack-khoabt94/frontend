import { Link, useRouter } from '@tanstack/react-router'
import { LogOut, User as UserIcon } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Logo } from '@/components/common/logo'
import { ModeToggle } from '@/components/mode-toggle'
import { useLogout } from '@/features/auth/queries'
import { useSession } from '@/features/auth/session'
import { initialsOf } from '@/lib/format'

export function AppHeader() {
  const { user } = useSession()
  const router = useRouter()
  const logout = useLogout()

  const handleLogout = async () => {
    logout()
    await router.navigate({ to: '/login', replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link to="/boards" search={{ view: 'active', q: '' }} aria-label="Taskflow home">
          <Logo />
        </Link>

        {/* `activeProps` comes from the router, so the highlight follows the URL
            rather than a duplicated piece of state. */}
        <nav aria-label="Main" className="flex items-center gap-1">
          <Link
            to="/boards"
            search={{ view: 'active', q: '' }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            activeProps={{ className: 'bg-secondary text-secondary-foreground' }}
          >
            Boards
          </Link>
          <Link
            to="/tasks"
            search={{ filter: 'all', q: '', sort: 'priority_desc' }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            activeProps={{ className: 'bg-secondary text-secondary-foreground' }}
          >
            All tasks
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ModeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 pr-2 pl-1.5" aria-label="Account menu">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-brand-50 text-xs font-medium text-brand-900 dark:bg-accent dark:text-brand-200">
                    {user ? initialsOf(user.name) : <UserIcon className="size-3.5" />}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-32 truncate text-sm sm:inline">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <span className="block text-sm font-medium">{user?.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => void handleLogout()}>
                <LogOut className="size-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
