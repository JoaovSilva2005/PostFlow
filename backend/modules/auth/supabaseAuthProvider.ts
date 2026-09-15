import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import {
  APP_ROLES,
  type AppRole,
  type AuthenticatedUser,
  type AuthProvider,
  type AuthSession,
} from './authTypes.js'

const DEFAULT_ROLE: AppRole = 'editor'

function readRole(value: unknown): AppRole {
  return APP_ROLES.includes(value as AppRole)
    ? (value as AppRole)
    : DEFAULT_ROLE
}

function toAuthenticatedUser(user: User): AuthenticatedUser {
  const email = user.email ?? ''

  return {
    id: user.id,
    email,
    displayName:
      typeof user.user_metadata.display_name === 'string'
        ? user.user_metadata.display_name
        : email.split('@')[0] || 'Usuário PostFlow',
    role: readRole(user.app_metadata.role),
  }
}

function toAuthSession(session: Session): AuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in,
    user: toAuthenticatedUser(session.user),
  }
}

export class SupabaseAuthProvider implements AuthProvider {
  private readonly createClient: () => SupabaseClient

  constructor(createClient: () => SupabaseClient) {
    this.createClient = createClient
  }

  async authenticate(accessToken: string) {
    const { data, error } = await this.createClient().auth.getUser(accessToken)

    if (error || !data.user) return null
    return toAuthenticatedUser(data.user)
  }

  async login(email: string, password: string) {
    const { data, error } = await this.createClient().auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.session) {
      throw error ?? new Error('Sessão não criada.')
    }

    return toAuthSession(data.session)
  }

  async register(displayName: string, email: string, password: string) {
    const { data, error } = await this.createClient().auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })

    if (error || !data.user) {
      throw error ?? new Error('Usuário não criado.')
    }

    return {
      user: toAuthenticatedUser(data.user),
      session: data.session ? toAuthSession(data.session) : null,
    }
  }

  async refresh(refreshToken: string) {
    const { data, error } = await this.createClient().auth.refreshSession({
      refresh_token: refreshToken,
    })

    if (error || !data.session) {
      throw error ?? new Error('Sessão não renovada.')
    }

    return toAuthSession(data.session)
  }

  async recoverPassword(email: string, redirectUrl: string) {
    const { error } = await this.createClient().auth.resetPasswordForEmail(
      email,
      {
        redirectTo: redirectUrl,
      },
    )

    if (error) throw error
  }

  async logout(accessToken: string) {
    await this.createClient().auth.getUser(accessToken)
  }
}
