import { z } from 'zod'

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string(),
})
export type User = z.infer<typeof userSchema>

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: userSchema,
})
export type AuthResponse = z.infer<typeof authResponseSchema>

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-zA-Z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number')

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
})
export type LoginInput = z.input<typeof loginSchema>
export type LoginPayload = z.output<typeof loginSchema>

// Lengths mirror CreateUserDto on the backend (name ≤ 30, email ≤ 50). The
// password rules are deliberately stricter than the server's @NotBlank —
// tightening the client never breaks a laxer server.
export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(30, 'Name must be 30 characters or fewer'),
    email: z.email('Enter a valid email address').max(50, 'Email must be 50 characters or fewer'),
    password,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type SignupInput = z.input<typeof signupSchema>
export type SignupPayload = z.output<typeof signupSchema>

export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address'),
})
export type ForgotPasswordPayload = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is missing or expired'),
    password,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>
export type ResetPasswordPayload = z.output<typeof resetPasswordSchema>

/** Rough 0-4 score used only to render the strength meter on Signup / Reset. */
export function passwordStrength(value: string) {
  if (!value) return 0
  let score = 0
  if (value.length >= 8) score += 1
  if (value.length >= 12) score += 1
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1
  if (/[0-9]/.test(value) && /[^a-zA-Z0-9]/.test(value)) score += 1
  return score
}
