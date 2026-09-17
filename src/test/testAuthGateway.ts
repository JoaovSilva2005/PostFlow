import type {
  AuthSession,
  AuthUser,
  LoginCredentials,
  RegistrationInput,
} from '../domain/auth'
import type { AuthGateway } from '../features/auth/authApi'

const TEST_SESSION_KEY = 'postflow:test-authenticated'

const testUser: AuthUser = {
  id: 'test-user',
  email: 'aluno@postflow.com',
  displayName: 'Aluno PostFlow',
}

const defaultSession: AuthSession = {
  user: testUser,
  workspace: { id: 'brand-1', role: 'owner' },
  platformRole: 'platform_owner',
}

export interface TestAuthGateway extends AuthGateway {
  lastLogin: LoginCredentials | null
  lastRegistration: RegistrationInput | null
}

export function createTestAuthGateway(
  session: AuthSession = defaultSession,
): TestAuthGateway {
  return {
    lastLogin: null,
    lastRegistration: null,
    async currentUser() {
      return localStorage.getItem(TEST_SESSION_KEY) === 'true' ? session : null
    },
    async login(credentials) {
      this.lastLogin = credentials
      localStorage.setItem(TEST_SESSION_KEY, 'true')
      return {
        ...session,
        user: { ...session.user, email: credentials.email },
      }
    },
    async register(input) {
      this.lastRegistration = input
      localStorage.setItem(TEST_SESSION_KEY, 'true')
      return {
        requiresEmailConfirmation: false,
        user: {
          ...session.user,
          displayName: input.displayName,
          email: input.email,
        },
      }
    },
    async recoverPassword() {
      return 'Instruções enviadas.'
    },
    async logout() {
      localStorage.removeItem(TEST_SESSION_KEY)
    },
  }
}

export function authenticateTestUser() {
  localStorage.setItem(TEST_SESSION_KEY, 'true')
}
