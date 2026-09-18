import type {
  AuthenticatedUser,
  AuthProvider,
  AuthSession,
  RegistrationDetails,
} from '../modules/auth/authTypes.js'

export const TEST_ACCESS_TOKEN = 'test-access-token'
export const TEST_REFRESH_TOKEN = 'test-refresh-token'

const testUser: AuthenticatedUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'aluno@postflow.com',
  displayName: 'Aluno PostFlow',
}

function session(user = testUser): AuthSession {
  return {
    accessToken: TEST_ACCESS_TOKEN,
    refreshToken: TEST_REFRESH_TOKEN,
    expiresIn: 3600,
    user,
  }
}

export class InMemoryAuthProvider implements AuthProvider {
  readonly recoveredEmails: string[] = []
  readonly users: Map<string, AuthenticatedUser>
  private readonly user: AuthenticatedUser

  constructor(_legacyRole?: 'owner' | 'admin' | 'editor' | 'viewer') {
    this.user = { ...testUser }
    this.users = new Map([[this.user.email, this.user]])
  }

  async authenticate(accessToken: string) {
    return accessToken === TEST_ACCESS_TOKEN ? this.user : null
  }

  async login(email: string, password: string) {
    const user = this.users.get(email)

    if (!user || password !== '123456') {
      throw new Error('Credenciais inválidas.')
    }

    return session(user)
  }

  async register(input: RegistrationDetails) {
    if (this.users.has(input.email) || input.password.length < 8) {
      throw new Error('Conta não criada.')
    }

    const user: AuthenticatedUser = {
      id: `user-${this.users.size + 1}`,
      email: input.email,
      displayName: input.displayName,
      brandName: input.brandName,
      segment: input.segment,
    }
    this.users.set(input.email, user)

    return { user, session: session(user) }
  }

  async refresh(refreshToken: string) {
    if (refreshToken !== TEST_REFRESH_TOKEN) {
      throw new Error('Refresh token inválido.')
    }

    return session(this.user)
  }

  async recoverPassword(email: string) {
    this.recoveredEmails.push(email)
  }

  async logout() {}
}
