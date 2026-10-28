import { HttpError } from '../../shared/HttpError.js'
import type { AuthProvider, RegistrationDetails } from './authTypes.js'

interface AuthProviderError {
  code?: unknown
  message?: unknown
  status?: unknown
}

function refreshFailureStatus(error: unknown) {
  const providerError = readProviderError(error)
  if ([400, 401, 403].includes(providerError.status ?? 0)) return 401
  return 503
}

function readProviderError(error: unknown): {
  code: string
  message: string
  status?: number
} {
  if (!error || typeof error !== 'object') {
    return { code: '', message: '' }
  }

  const providerError = error as AuthProviderError

  return {
    code: typeof providerError.code === 'string' ? providerError.code : '',
    message:
      typeof providerError.message === 'string' ? providerError.message : '',
    status:
      typeof providerError.status === 'number' ? providerError.status : undefined,
  }
}

function registrationError(error: unknown) {
  const providerError = readProviderError(error)
  const searchableError = `${providerError.code} ${providerError.message}`.toLowerCase()

  // O SMTP padrão do Supabase tem uma cota pequena. Esta resposta informa a
  // indisponibilidade temporária sem expor dados internos do provedor.
  if (
    providerError.status === 429 ||
    searchableError.includes('over_email_send_rate_limit') ||
    searchableError.includes('email rate limit')
  ) {
    return new HttpError(
      429,
      'O limite temporário de e-mails de confirmação foi atingido. Aguarde e tente novamente mais tarde.',
    )
  }

  if (
    searchableError.includes('user_already_exists') ||
    searchableError.includes('email_exists') ||
    searchableError.includes('already registered')
  ) {
    return new HttpError(
      409,
      'Já existe uma conta com este e-mail. Entre ou recupere sua senha.',
    )
  }

  if (
    searchableError.includes('weak_password') ||
    searchableError.includes('password should')
  ) {
    return new HttpError(
      400,
      'A senha não atende aos requisitos de segurança. Escolha uma senha mais forte.',
    )
  }

  if (
    searchableError.includes('signup_disabled') ||
    searchableError.includes('signups not allowed')
  ) {
    return new HttpError(
      503,
      'Novos cadastros estão temporariamente indisponíveis.',
    )
  }

  return new HttpError(
    400,
    'Não foi possível criar a conta. Confira os dados informados.',
  )
}

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

  async register(input: RegistrationDetails) {
    try {
      return await this.provider.register(input)
    } catch (error) {
      console.warn('Falha no cadastro pelo provedor de autenticação.')

      throw registrationError(error)
    }
  }

  async refresh(refreshToken: string) {
    try {
      return await this.provider.refresh(refreshToken)
    } catch (error) {
      const status = refreshFailureStatus(error)
      throw new HttpError(
        status,
        status === 401
          ? 'Sessão inválida ou expirada.'
          : 'Não foi possível validar a sessão agora. Tente novamente em instantes.',
      )
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

  async logout(accessToken: string | null, refreshToken: string | null) {
    if (!accessToken || !refreshToken) return

    try {
      await this.provider.logout(accessToken, refreshToken)
    } catch {
      throw new HttpError(
        503,
        'Os cookies locais foram removidos, mas não foi possível revogar a sessão agora.',
      )
    }
  }
}
