import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { AuthShell } from '@/features/auth/components/auth-shell'
import { useForgotPassword } from '@/features/auth/queries'
import { forgotPasswordSchema, type ForgotPasswordPayload } from '@/features/auth/schemas'
import { getApiErrorMessage } from '@/lib/api/client'

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword()

  const form = useForm<ForgotPasswordPayload>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const submit = form.handleSubmit(async (values) => {
    await forgotPassword.mutateAsync(values)
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

  // Success state deliberately does not reveal whether the email is registered.
  if (forgotPassword.isSuccess) {
    return (
      <AuthShell
        title="Check your inbox"
        description={
          <>
            If an account exists for{' '}
            <span className="font-medium text-foreground">{form.getValues('email')}</span>, we have
            sent a link to reset your password.
          </>
        }
        footer={backToLogin}
      >
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-10 text-center">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-900 dark:bg-accent dark:text-brand-200">
              <MailCheck className="size-5" />
            </span>
            <p className="text-sm text-muted-foreground">
              The link expires in 30 minutes. Remember to check your spam folder.
            </p>
          </div>

          <Button
            variant="outline"
            size="lg"
            className="h-10 w-full"
            onClick={() => forgotPassword.reset()}
          >
            Use a different email
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter the email on your account and we will send you a reset link."
      footer={backToLogin}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {forgotPassword.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{getApiErrorMessage(forgotPassword.error)}</AlertDescription>
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
              autoFocus
              className="h-10"
              aria-invalid={Boolean(form.formState.errors.email)}
              {...form.register('email')}
            />
            <FieldError errors={[form.formState.errors.email]} />
          </Field>
        </FieldGroup>

        <Button type="submit" size="lg" className="h-10 w-full" disabled={forgotPassword.isPending}>
          {forgotPassword.isPending && <Loader2 className="size-4 animate-spin" />}
          Send reset link
        </Button>
      </form>
    </AuthShell>
  )
}
