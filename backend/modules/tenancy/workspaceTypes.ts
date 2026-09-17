export const WORKSPACE_ROLES = ['owner', 'admin', 'editor', 'viewer'] as const
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number]

export const PLATFORM_ROLES = [
  'platform_owner',
  'finance_admin',
  'support',
] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]
export type BillingAccessStatus =
  'none' | 'trialing' | 'active' | 'past_due' | 'cancelled'

export interface WorkspaceMembership {
  workspaceId: string
  userId: string
  role: WorkspaceRole
}

export interface WorkspaceContext {
  workspaceId: string
  role: WorkspaceRole
}

export interface WorkspaceAccessRepository {
  getMembership(
    userId: string,
    workspaceId: string,
  ): Promise<WorkspaceMembership | null>
  getDefaultWorkspace(userId: string): Promise<WorkspaceMembership | null>
  getPlatformRole(userId: string): Promise<PlatformRole | null>
  getBillingStatus(workspaceId: string): Promise<BillingAccessStatus>
}
