import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/api/client'
import { authApi } from './api'
import { sessionStore } from './session'
import type {
  AuthResponse,
  ForgotPasswordPayload,
  LoginPayload,
  ResetPasswordPayload,
  SignupPayload,
} from './schemas'

function persist(result: AuthResponse) {
  sessionStore.set({ accessToken: result.accessToken, user: result.user })
}

export function useLogin() {
  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: persist,
  })
}

export function useSignup() {
  return useMutation({
    mutationFn: (payload: SignupPayload) => authApi.signup(payload),
    onSuccess: persist,
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

export function useLogout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => authApi.logout(),
    // The session is dropped either way — a failed logout call must never
    // strand the user in a signed-in shell.
    onSettled: () => {
      sessionStore.clear()
      client.clear()
    },
    onError: (error) =>
      toast.message('Signed out locally', { description: getApiErrorMessage(error) }),
  })
}
