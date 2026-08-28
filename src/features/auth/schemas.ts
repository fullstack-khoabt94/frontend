import { z } from 'zod'

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string(),
})
export type User = z.infer<typeof userSchema>

/**
 * `LoginResponse` on the backend — returned by both /auth/login and
 * /auth/refresh-token.
 *
 * The access token's life arrives as a duration in seconds; the refresh token's
 * as an absolute deadline, because the backend stores it that way and refreshing
 * never extends it.
 *
 * Despite its name, `refreshTokenExpiresIn` is a **timestamp**, and a zone-less
 * one — it is a Java `LocalDateTime`, so it reads `"2026-08-29T03:15:30"` with no
 * `Z` and no offset. `{ local: true }` is what lets that through; the default
 * `z.iso.datetime()` rejects it. `sessionFromAuthResponse()` documents what the
 * client does about the missing zone.
 */
export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessTokenExpiresIn: z.number(),
  refreshTokenExpiresIn: z.iso.datetime({ local: true }),
  user: userSchema,
})
export type AuthResponse = z.infer<typeof authResponseSchema>

/**
 * What the session cookie holds. Deliberately its own schema rather than a reuse
 * of `authResponseSchema`: a new required field on the login response would
 * otherwise invalidate every cookie already in a browser, signing everyone out.
 *
 * `expiresAt` is epoch milliseconds **on the browser's own clock**, computed when
 * the tokens arrived. Storing the deadline rather than the duration is what makes
 * it comparable after a reload, and keeping it in client time is what keeps a
 * skewed clock from mattering.
 */
export const storedSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().nullable().default(null),
  expiresAt: z.number(),
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
