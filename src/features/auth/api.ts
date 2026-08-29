import axios, { type AxiosRequestConfig } from 'axios'
import { api, getApiErrorMessage } from '@/lib/api/client'
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
  /**
   * `LoginDto` on the backend is `{ email, password }` only — `rememberMe` is a
   * client-side concern and is deliberately not sent.
   */
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await api.post('/auth/login', {
      email: payload.email,
      password: payload.password,
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

  /**
   * The identity endpoint lives under `/user`, not `/auth` — it reads the UUID
   * straight off the authenticated principal, so it doubles as the only way to
   * ask the backend whether an access token is still good.
   */
  async me(config?: AxiosRequestConfig): Promise<User> {
    const { data } = await api.get('/user/me', config)
    return userSchema.parse(data)
  },

  /**
   * The backend calls this `/auth/request-reset-password-token`, not
   * `/auth/forgot-password` — `AuthController` names the endpoint after the row
   * it writes rather than the screen that calls it.
   *
   * It answers `200` with a bare `text/plain` body (`"Token issued!"`), so there
   * is nothing worth parsing: the caller only needs to know it did not throw.
   */
  async forgotPassword(payload: ForgotPasswordPayload): Promise<void> {
    await api.post('/auth/request-reset-password-token', { email: payload.email })
  },

  /**
   * `PUT`, not `POST` — and the field names are the backend's:
   * `ResetPasswordRequestDto` is `{ resetpwToken, newPassword }`. Sending
   * `{ token, password }` deserialises to two nulls and fails `@NotBlank` with a
   * `400` that never mentions the real cause.
   *
   * Answers `200` with `text/plain` (`"Success!"`), so again nothing to parse.
   */
  async resetPassword(payload: ResetPasswordPayload): Promise<void> {
    await api.put('/auth/reset-password', {
      resetpwToken: payload.token,
      newPassword: payload.password,
    })
  },
}

/**
 * A rejected sign-in carries no body worth showing — the message has to come
 * from the status code, and it stays vague on purpose so the form never reveals
 * whether the email exists.
 */
export function getLoginErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    if (status === 401 || status === 403) return 'Email or password is incorrect.'
  }
  return getApiErrorMessage(error)
}
