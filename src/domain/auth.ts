export type AppRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  role: AppRole
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegistrationInput extends LoginCredentials {
  displayName: string
}

export interface RegistrationResponse {
  requiresEmailConfirmation: boolean
  user: AuthUser
}
