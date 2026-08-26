import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { AuthShell } from '@/features/auth/components/auth-shell'
import { PasswordInput } from '@/features/auth/components/password-input'
import { useSignup } from '@/features/auth/queries'
import { signupSchema, type SignupInput, type SignupPayload } from '@/features/auth/schemas'
import { getApiErrorMessage } from '@/lib/api/client'

export const Route = createFileRoute('/_auth/signup')({
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const signup = useSignup()

  const form = useForm<SignupInput, unknown, SignupPayload>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  const submit = form.handleSubmit(async (values) => {
    const user = await signup.mutateAsync(values)
    // Signup issues no token, so the account exists but the session does not —
    // send them to sign in rather than to a guard that would bounce them back.
    toast.success('Account created', { description: `Sign in as ${user.email} to continue.` })
    await navigate({ to: '/login', replace: true })
  })

  return (
    <AuthShell
      title="Create your account"
      description="Start organising your work in less than a minute."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {signup.isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{getApiErrorMessage(signup.error)}</AlertDescription>
          </Alert>
        )}

        <FieldGroup>
          <Field data-invalid={Boolean(form.formState.errors.name)}>
            <FieldLabel htmlFor="name">Full name</FieldLabel>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Alex Nguyen"
              className="h-10"
              aria-invalid={Boolean(form.formState.errors.name)}
              {...form.register('name')}
            />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>

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
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              className="h-10"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register('password')}
            />
            <FieldError errors={[form.formState.errors.password]} />
          </Field>

          <Field data-invalid={Boolean(form.formState.errors.confirmPassword)}>
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
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

        <Button type="submit" size="lg" className="h-10 w-full" disabled={signup.isPending}>
          {signup.isPending && <Loader2 className="size-4 animate-spin" />}
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
