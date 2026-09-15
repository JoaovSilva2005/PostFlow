import type {
  AuthUser,
  LoginCredentials,
  RegistrationInput,
  RegistrationResponse,
} from '../../domain/auth'
import { ApiError, apiRequest } from '../../services/apiClient'

interface UserResponse {
  user: AuthUser
}

interface RecoveryResponse {
  message: string
}

export interface AuthGateway {
  currentUser(): Promise<AuthUser | null>
  login(credentials: LoginCredentials): Promise<AuthUser>
  logout(): Promise<void>
  recoverPassword(email: string): Promise<string>
  register(input: RegistrationInput): Promise<RegistrationResponse>
}

async function readCurrentUser() {
  return (await apiRequest<UserResponse>('/auth/me')).user
}

export const authApi: AuthGateway = {
  async currentUser() {
    try {
      return await readCurrentUser()
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error
    }

    try {
      await apiRequest<UserResponse>('/auth/refresh', { method: 'POST' })
      return await readCurrentUser()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },

  async login(credentials) {
    return (
      await apiRequest<UserResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      })
    ).user
  },

  register: (input) =>
    apiRequest<RegistrationResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  async recoverPassword(email) {
    return (
      await apiRequest<RecoveryResponse>('/auth/recover', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
    ).message
  },

  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
}
