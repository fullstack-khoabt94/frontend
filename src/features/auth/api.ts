import { api } from '@/lib/api/client'
import {
  authResponseSchema,
  userSchema,
  type AuthResponse,
  type ForgotPasswordPayload,
  type LoginPayload,
  type ResetPasswordPayload,
  type SignupPayload,
  type User,
} from './schemas'

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await api.post('/auth/login', {
      email: payload.email,
      password: payload.password,
      rememberMe: payload.rememberMe,
    })
    return authResponseSchema.parse(data)
  },

  /**
   * Signup creates the account but does not issue a token — the backend answers
   * `201` with the user only, so the caller has to send them to /login.
   */
  async signup(payload: SignupPayload): Promise<User> {
    const { data } = await api.post('/auth/signup', {
      name: payload.name,
      email: payload.email,
      password: payload.password,
    })
    return userSchema.parse(data)
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },

  async me(): Promise<User> {
    const { data } = await api.get('/auth/me')
    return userSchema.parse(data)
  },

  async forgotPassword(payload: ForgotPasswordPayload): Promise<{ message: string }> {
    const { data } = await api.post('/auth/forgot-password', payload)
    return data
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<{ message: string }> {
    const { data } = await api.post('/auth/reset-password', {
      token: payload.token,
      password: payload.password,
    })
    return data
  },
}
