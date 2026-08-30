import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { AuthShell } from '@/features/auth/components/auth-shell'
import { PasswordInput } from '@/features/auth/components/password-input'
import { useLogin } from '@/features/auth/queries'
import { getLoginErrorMessage } from '@/features/auth/api'
import { loginSchema, type LoginInput, type LoginPayload } from '@/features/auth/schemas'

export const Route = createFileRoute('/_auth/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  const navigate = useNavigate()
  const login = useLogin()

  const form = useForm<LoginInput, unknown, LoginPayload>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: true },
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
    } catch {
      // The alert above already renders the reason; rethrowing here would only
      // surface as an unhandled rejection.
      return
    }
    // `redirect` is a fully built href captured by the /_app guard, so it keeps
    // the filter / search / sort params the visitor was on.
    if (redirect) {
      await navigate({ href: redirect, replace: true })
      return
    }
    await navigate({ to: '/boards', search: { view: 'active', q: '' }, replace: true })
  })

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to pick up where you left off."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {login.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{getLoginErrorMessage(login.error)}</AlertDescription>
          </Alert>
        )}

        <FieldGroup>
          <Field data-invalid={Boolean(form.formState.errors.email)}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              className="h-10"
              aria-invalid={Boolean(form.formState.errors.email)}
              {...form.register('email')}
            />
            <FieldError errors={[form.formState.errors.email]} />
          </Field>

          <Field data-invalid={Boolean(form.formState.errors.password)}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="h-10"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register('password')}
            />
            <FieldError errors={[form.formState.errors.password]} />
          </Field>

          <Field orientation="horizontal">
            <Controller
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <Checkbox
                  id="rememberMe"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <FieldLabel htmlFor="rememberMe" className="text-sm font-normal">
              Keep me signed in
            </FieldLabel>
          </Field>
        </FieldGroup>

        <Button type="submit" size="lg" className="h-10 w-full" disabled={login.isPending}>
          {login.isPending && <Loader2 className="size-4 animate-spin" />}
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
