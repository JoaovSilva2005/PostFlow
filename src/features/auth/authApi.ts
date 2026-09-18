import type {
  AuthSession,
  AuthUser,
  LoginCredentials,
  RegistrationInput,
  RegistrationResponse,
} from '../../domain/auth'
import { ApiError, apiRequest } from '../../services/apiClient'

interface UserResponse {
  user: AuthUser
  workspace?: AuthSession['workspace']
  platformRole?: AuthSession['platformRole']
  billingStatus?: AuthSession['billingStatus']
}

interface RecoveryResponse {
  message: string
}

export interface AuthGateway {
  currentUser(): Promise<AuthSession | null>
  login(credentials: LoginCredentials): Promise<AuthSession>
  logout(): Promise<void>
  recoverPassword(email: string): Promise<string>
  register(input: RegistrationInput): Promise<RegistrationResponse>
}

function toSession(response: UserResponse): AuthSession {
  return {
    user: response.user,
    workspace: response.workspace ?? null,
    platformRole: response.platformRole ?? null,
    billingStatus: response.billingStatus ?? 'none',
  }
}

async function readCurrentSession() {
  return toSession(await apiRequest<UserResponse>('/auth/me'))
}

async function ensureWorkspace(session: AuthSession) {
  if (session.workspace || session.platformRole) return session

  return toSession(
    await apiRequest<UserResponse>('/auth/workspace', { method: 'POST' }),
  )
}

async function readUsableSession() {
  return ensureWorkspace(await readCurrentSession())
}

export const authApi: AuthGateway = {
  async currentUser() {
    try {
      return await readUsableSession()
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error
    }

    try {
      await apiRequest<UserResponse>('/auth/refresh', { method: 'POST' })
      return await readUsableSession()
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },

  async login(credentials) {
    await apiRequest<UserResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    return readUsableSession()
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
