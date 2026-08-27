import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from './api'
import { sessionStore } from './session'
import type {
  AuthResponse,
  ForgotPasswordPayload,
  LoginPayload,
  ResetPasswordPayload,
  SignupPayload,
} from './schemas'

function persist(result: AuthResponse, remember: boolean) {
  sessionStore.set({ accessToken: result.accessToken, user: result.user }, remember)
}

export function useLogin() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (result, payload) => {
      // `rememberMe` never reaches the backend — it only decides whether the
      // session is mirrored into a cookie and survives a reload.
      persist(result, payload.rememberMe)
      // Whatever the previous visitor left in the cache belongs to their token,
      // not to this one.
      client.clear()
    },
  })
}

/**
 * No `persist` here: signup returns the created user without an access token,
 * so the account exists but the visitor is still signed out.
 */
export function useSignup() {
  return useMutation({
    mutationFn: (payload: SignupPayload) => authApi.signup(payload),
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordPayload) => authApi.forgotPassword(payload),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => authApi.resetPassword(payload),
  })
}

/**
 * The JWT is stateless and there is no `/auth/logout` on the backend, so signing
 * out is a local operation: drop the token and wipe the cache it was fetched
 * with. It returns a plain callback rather than a mutation — there is nothing
 * to await, fail or retry.
 */
export function useLogout() {
  const client = useQueryClient()
  return useCallback(() => {
    sessionStore.clear()
    client.clear()
  }, [client])
}
