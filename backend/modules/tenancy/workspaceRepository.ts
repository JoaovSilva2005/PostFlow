import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  PlatformRole,
  BillingAccessStatus,
  WorkspaceAccessRepository,
  WorkspaceMembership,
  WorkspaceIdentity,
  WorkspaceRole,
} from './workspaceTypes.js'

export class SupabaseWorkspaceAccessRepository implements WorkspaceAccessRepository {
  private readonly supabase: SupabaseClient
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async getMembership(userId: string, workspaceId: string) {
    const { data, error } = await this.supabase
      .from('brand_members')
      .select('brand_id, user_id, role')
      .eq('brand_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw new Error(`Falha ao consultar workspace: ${error.message}`)
    if (!data) return null
    return {
      workspaceId: data.brand_id,
      userId: data.user_id,
      role: data.role as WorkspaceRole,
    } satisfies WorkspaceMembership
  }

  async getDefaultWorkspace(userId: string) {
    const { data, error } = await this.supabase
      .from('brand_members')
      .select('brand_id, user_id, role')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(`Falha ao consultar workspace: ${error.message}`)
    return data
      ? {
          workspaceId: data.brand_id,
          userId: data.user_id,
          role: data.role as WorkspaceRole,
        }
      : null
  }

  async ensureDefaultWorkspace(user: WorkspaceIdentity) {
    const displayName =
      user.displayName.trim() || user.email.split('@')[0] || 'Usuário PostFlow'
    const { data, error } = await this.supabase.rpc('ensure_default_workspace', {
      p_user_id: user.id,
      p_email: user.email,
      p_display_name: displayName,
      p_brand_name:
        user.brandName?.trim().slice(0, 120) ||
        `Workspace de ${displayName}`.slice(0, 120),
      p_segment: user.segment?.trim().slice(0, 80) || 'A definir',
    })
    if (error) {
      throw new Error(`Falha ao provisionar workspace: ${error.message}`)
    }

    const result = (Array.isArray(data) ? data[0] : data) as
      | { workspace_id?: string; user_id?: string; role?: string }
      | null
    if (!result?.workspace_id || !result.user_id || !result.role) {
      throw new Error('Provisionamento não retornou o membership do workspace.')
    }

    return {
      workspaceId: result.workspace_id,
      userId: result.user_id,
      role: result.role as WorkspaceRole,
    } satisfies WorkspaceMembership
  }

  async getPlatformRole(userId: string) {
    const { data, error } = await this.supabase
      .from('platform_members')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle()
    if (error)
      throw new Error(
        `Falha ao consultar papel de plataforma: ${error.message}`,
      )
    return (data?.role as PlatformRole | undefined) ?? null
  }

  async getBillingStatus(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select('status')
      .eq('brand_id', workspaceId)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error)
      throw new Error(`Falha ao consultar assinatura: ${error.message}`)
    return (data?.status as BillingAccessStatus | undefined) ?? 'none'
  }
}

/** Apenas para dependências injetadas em testes; não é usado em produção. */
export class InMemoryWorkspaceAccessRepository implements WorkspaceAccessRepository {
  private workspaceId: string | null
  private readonly workspaceRole: WorkspaceRole
  private readonly platformRole: PlatformRole | null
  private readonly billingStatus: BillingAccessStatus
  constructor(
    workspaceId: string | null = 'test-workspace',
    workspaceRole: WorkspaceRole = 'editor',
    platformRole: PlatformRole | null = null,
    billingStatus: BillingAccessStatus = 'active',
  ) {
    this.workspaceId = workspaceId
    this.workspaceRole = workspaceRole
    this.platformRole = platformRole
    this.billingStatus = billingStatus
  }

  async getMembership(userId: string, workspaceId: string) {
    return workspaceId === this.workspaceId
      ? { workspaceId, userId, role: this.workspaceRole }
      : null
  }

  async getDefaultWorkspace(userId: string) {
    return this.workspaceId
      ? { workspaceId: this.workspaceId, userId, role: this.workspaceRole }
      : null
  }

  async ensureDefaultWorkspace(user: WorkspaceIdentity) {
    this.workspaceId ??= `workspace-${user.id}`
    return {
      workspaceId: this.workspaceId,
      userId: user.id,
      role: this.workspaceRole,
    }
  }

  async getPlatformRole() {
    return this.platformRole
  }

  async getBillingStatus() {
    return this.billingStatus
  }
}
