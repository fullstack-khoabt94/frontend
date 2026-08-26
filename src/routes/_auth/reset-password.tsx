import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ArrowLeft, KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { AuthShell } from '@/features/auth/components/auth-shell'
import { PasswordInput } from '@/features/auth/components/password-input'
import { useResetPassword } from '@/features/auth/queries'
import {
  resetPasswordSchema,
  type ResetPasswordInput,
  type ResetPasswordPayload,
} from '@/features/auth/schemas'
import { getApiErrorMessage } from '@/lib/api/client'

export const Route = createFileRoute('/_auth/reset-password')({
  // The token arrives in the emailed link: /reset-password?token=…
  validateSearch: z.object({ token: z.string().optional() }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const resetPassword = useResetPassword()

  const form = useForm<ResetPasswordInput, unknown, ResetPasswordPayload>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token: token ?? '', password: '', confirmPassword: '' },
  })

  const submit = form.handleSubmit(async (values) => {
    await resetPassword.mutateAsync(values)
    toast.success('Password updated', { description: 'Sign in with your new password.' })
    await navigate({ to: '/login', replace: true })
  })

  const backToLogin = (
    <Link
      to="/login"
      className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
    >
      <ArrowLeft className="size-3.5" />
      Back to sign in
    </Link>
  )

  if (!token) {
    return (
      <AuthShell
        title="Reset link missing"
        description="Open the link from your email, or request a new one."
        footer={backToLogin}
      >
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/60 px-6 py-10 text-center">
            <span className="grid size-11 place-items-center rounded-xl bg-muted text-muted-foreground">
              <KeyRound className="size-5" />
            </span>
            <p className="text-sm text-muted-foreground">
              This page needs a valid reset token to continue.
            </p>
          </div>
          <Button size="lg" className="h-10 w-full" asChild>
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Set a new password"
      description="Choose a password you have not used on this account before."
      footer={backToLogin}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <input type="hidden" {...form.register('token')} />

        {resetPassword.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{getApiErrorMessage(resetPassword.error)}</AlertDescription>
          </Alert>
        )}

        <FieldGroup>
          <Field data-invalid={Boolean(form.formState.errors.password)}>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              autoFocus
              className="h-10"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register('password')}
            />
            <FieldError errors={[form.formState.errors.password]} />
          </Field>

          <Field data-invalid={Boolean(form.formState.errors.confirmPassword)}>
            <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              className="h-10"
              aria-invalid={Boolean(form.formState.errors.confirmPassword)}
              {...form.register('confirmPassword')}
            />
            <FieldError errors={[form.formState.errors.confirmPassword]} />
          </Field>
        </FieldGroup>

        <Button type="submit" size="lg" className="h-10 w-full" disabled={resetPassword.isPending}>
          {resetPassword.isPending && <Loader2 className="size-4 animate-spin" />}
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
