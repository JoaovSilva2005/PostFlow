import type {
  AuthenticatedUser,
  AuthProvider,
  AuthSession,
  RegistrationDetails,
} from '../modules/auth/authTypes.js'

export const TEST_ACCESS_TOKEN = 'test-access-token'
export const TEST_REFRESH_TOKEN = 'test-refresh-token'
export const TEST_RECOVERY_TOKEN_HASH = 'test-recovery-token-hash'

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
  readonly loggedOutSessions: Array<{
    accessToken: string
    refreshToken: string
  }> = []
  readonly users: Map<string, AuthenticatedUser>
  private readonly user: AuthenticatedUser
  private readonly passwords = new Map<string, string>()
  private pendingRecoveryEmail: string | null = null

  constructor(_legacyRole?: 'owner' | 'admin' | 'editor' | 'viewer') {
    this.user = { ...testUser }
    this.users = new Map([[this.user.email, this.user]])
    this.passwords.set(this.user.email, '123456')
  }

  async authenticate(accessToken: string) {
    return accessToken === TEST_ACCESS_TOKEN ? this.user : null
  }

  async login(email: string, password: string) {
    const user = this.users.get(email)

    if (!user || password !== this.passwords.get(email)) {
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
    this.passwords.set(input.email, input.password)

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
    this.pendingRecoveryEmail = this.users.has(email) ? email : null
  }

  async resetPassword(tokenHash: string, password: string) {
    if (tokenHash !== TEST_RECOVERY_TOKEN_HASH || !this.pendingRecoveryEmail) {
      throw Object.assign(new Error('OTP inválido ou expirado.'), {
        status: 403,
      })
    }
    const email = this.pendingRecoveryEmail
    this.pendingRecoveryEmail = null
    this.passwords.set(email, password)
  }

  async logout(accessToken: string, refreshToken: string) {
    this.loggedOutSessions.push({ accessToken, refreshToken })
  }
}
