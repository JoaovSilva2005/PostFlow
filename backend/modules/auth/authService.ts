import { HttpError } from '../../shared/HttpError.js'
import type { AppRole, AuthProvider } from './authTypes.js'

export class AuthService {
  private readonly provider: AuthProvider

  constructor(provider: AuthProvider) {
    this.provider = provider
  }

  async authenticate(accessToken: string) {
    const user = await this.provider.authenticate(accessToken)

    if (!user) {
      throw new HttpError(401, 'Sessão inválida ou expirada.')
    }

    return user
  }

  async login(email: string, password: string) {
    try {
      return await this.provider.login(email, password)
    } catch {
      throw new HttpError(401, 'E-mail ou senha inválidos.')
    }
  }

  async register(displayName: string, email: string, password: string) {
    try {
      return await this.provider.register(displayName, email, password)
    } catch {
      throw new HttpError(
        400,
        'Não foi possível criar a conta. Confira os dados informados.',
      )
    }
  }

  async refresh(refreshToken: string) {
    try {
      return await this.provider.refresh(refreshToken)
    } catch {
      throw new HttpError(401, 'Não foi possível renovar a sessão.')
    }
  }

  async recoverPassword(email: string, redirectUrl: string) {
    try {
      await this.provider.recoverPassword(email, redirectUrl)
    } catch {
      throw new HttpError(
        503,
        'Não foi possível enviar o e-mail de recuperação agora.',
      )
    }
  }

  async logout(accessToken: string | null) {
    if (!accessToken) return

    try {
      await this.provider.logout(accessToken)
    } catch {
      // A sessão local ainda é encerrada removendo os cookies.
    }
  }

  canAccess(role: AppRole, allowedRoles: readonly AppRole[]) {
    return allowedRoles.includes(role)
  }
}
