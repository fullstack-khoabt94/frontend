import { z } from 'zod'

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string(),
})
export type User = z.infer<typeof userSchema>

/** `LoginResponse` on the backend — returned by both /auth/login and /auth/refresh-token. */
export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: userSchema,
})
export type AuthResponse = z.infer<typeof authResponseSchema>

/**
 * What the session cookie holds. Deliberately its own schema rather than a reuse
 * of `authResponseSchema`: a new required field on the login response would
 * otherwise invalidate every cookie already in a browser, signing everyone out.
 * `refreshToken` is nullable for cookies written before it existed.
 */
export const storedSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().nullable().default(null),
  user: userSchema,
})

const password = z.string().min(6, 'Password must be at least 6 characters')

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
})
export type LoginInput = z.input<typeof loginSchema>
export type LoginPayload = z.output<typeof loginSchema>

// Lengths mirror CreateUserDto on the backend (name ≤ 30, email ≤ 50).
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
