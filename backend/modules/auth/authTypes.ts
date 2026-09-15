export const APP_ROLES = ['owner', 'admin', 'editor', 'viewer'] as const

export type AppRole = (typeof APP_ROLES)[number]

export interface AuthenticatedUser {
  id: string
  email: string
  displayName: string
  role: AppRole
}

export interface AuthSession {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthenticatedUser
}

export interface RegistrationResult {
  session: AuthSession | null
  user: AuthenticatedUser
}

export interface AuthProvider {
  authenticate(accessToken: string): Promise<AuthenticatedUser | null>
  login(email: string, password: string): Promise<AuthSession>
  logout(accessToken: string): Promise<void>
  recoverPassword(email: string, redirectUrl: string): Promise<void>
  refresh(refreshToken: string): Promise<AuthSession>
  register(
    displayName: string,
    email: string,
    password: string,
  ): Promise<RegistrationResult>
}
