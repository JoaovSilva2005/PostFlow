export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer'
export type PlatformRole = 'platform_owner' | 'finance_admin' | 'support' | null

export interface AuthUser {
  id: string
  email: string
  displayName: string
}

export interface WorkspaceAccess {
  id: string
  role: WorkspaceRole
}

export interface AuthSession {
  user: AuthUser
  workspace: WorkspaceAccess | null
  platformRole: PlatformRole
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
  workspace?: WorkspaceAccess | null
  platformRole?: PlatformRole
}
